import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DuckDBHandle } from "../core/duckdb/initDuckDB";
import { initDuckDB } from "../core/duckdb/initDuckDB";
import { closeDuckDB } from "../core/duckdb/closeDuckDB";
import { ingestCSV } from "../core/duckdb/ingestCSV";
import { ingestExcel } from "../core/duckdb/ingestExcel";
import { buildSchemaName, quoteIdent } from "../core/duckdb/sql";
import { buildDatasetDigest } from "../core/profiling/buildDigest";
import {
  runPython,
  resetPythonEngine,
  subscribePythonStatus,
  preloadPythonEngine,
  type PythonExecutionResult,
  type PythonStatus,
} from "../core/python";
import {
  buildLocalSuggestions,
} from "../core/agent/suggestions";
import { runAgentTurn } from "../core/agent/runAgentTurn";
import { buildTraceExport, traceExportFileName } from "../core/agent/trace";
import {
  editFigure as editFigureContent,
  type FigureChanges,
} from "../core/parsing/editFigure";
import {
  buildTranscript,
  downloadTextFile,
  transcriptFileName,
} from "../core/export/transcript";
import {
  clearApiKey as persistClearApiKey,
  getStoredApiKey,
  getStoredModel,
  saveApiKey as persistApiKey,
  saveModel as persistModel,
} from "../core/storage/settings";
import {
  clearSessionRegistry,
  registerSession,
  unregisterSession,
} from "../core/storage/sessions";
import {
  clearPersistedWorkspace,
  deletePersistedSession,
  loadSessionFile,
  saveActiveSessionId,
  savePersistedSession,
  saveSessionFile,
} from "../core/storage/persistence";
import {
  getPanelOpen,
  getSidebarOpen,
  savePanelOpen,
  saveSidebarOpen,
} from "../core/storage/uiPrefs";
import {
  clearWorkspaceCache,
  readWorkspaceCache,
  type WorkspaceCache,
} from "../core/storage/workspaceCache";
import { downloadFile } from "../core/storage/fileAccess";
import { inspectWorkbookInWorker } from "../core/workers/excelClient";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  WELCOME_MAX_TABLES,
} from "../core/constants";
import { NEEDS_ACCESS_KEY } from "../core/config";
import { recordMetric } from "../core/metrics";
import { formatCount } from "../core/utils/format";
import {
  bootstrapWorkspace,
  normalizeMessages,
  normalizeSession,
  type BootstrapResult,
} from "./session/workspaceBootstrap";
import { useWorkspacePersistence } from "./session/useWorkspacePersistence";
import type {
  ChatMessage,
  DatasetDigest,
  FileKind,
  ModelId,
  PanelTab,
  Session,
  ToolTraceEntry,
  UploadState,
} from "../core/types";

/**
 * Workspace state container.
 *
 * Responsibilities:
 *  - own the DuckDB handle and rebuild every persisted session on boot,
 *  - ingest uploads and keep a live dataset digest for the agent,
 *  - run agent turns and stream deltas into the active transcript,
 *  - generate data-derived follow-up suggestions after every answer,
 *  - persist transcripts and layout so a refresh loses nothing.
 *
 * Actions are exposed through a separate context so components that only need
 * to *do* things (buttons, composer) do not re-render on every streamed token.
 */

import {
  SessionStateContext,
  SessionActionsContext,
  useSession,
  useSessionState,
  useSessionActions,
  type SheetPickerRequest,
  type SessionState,
  type SessionActions,
  type SessionContextValue,
} from "./session/sessionContext";

export {
  useSession,
  useSessionState,
  useSessionActions,
  type SheetPickerRequest,
  type SessionState,
  type SessionActions,
  type SessionContextValue,
};

const IDLE_UPLOAD: UploadState = { phase: "idle", fileName: null, message: "" };

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getFileKind(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
}

function buildWelcomeMessage(
  session: Session,
  suggestions: string[],
): ChatMessage {
  const tables = Array.isArray(session?.tables) ? session.tables : [];
  const totalRows = tables.reduce(
    (total, table) => total + (table?.rowCount ?? 0),
    0,
  );
  const ranked = [...tables].sort(
    (left, right) =>
      (right?.rowCount ?? 0) - (left?.rowCount ?? 0) ||
      (right?.columnCount ?? 0) - (left?.columnCount ?? 0),
  );
  const listed = ranked.slice(0, WELCOME_MAX_TABLES);
  const tableLines = listed
    .map(
      (table) =>
        `- \`${table.name}\` — ${formatCount(table.rowCount ?? 0)} rows · ${table.columnCount ?? 0} columns`,
    )
    .join("\n");
  const more =
    tables.length > listed.length
      ? `\n…and ${formatCount(tables.length - listed.length)} more tables. Ask about a specific sheet or column.`
      : "";

  return {
    id: createId(),
    role: "assistant",
    createdAt: Date.now(),
    welcome: true,
    suggestions: Array.isArray(suggestions) ? suggestions : [],
    suggestionsPending: false,
    content: `**${session.fileName} is ready.**

Loaded ${formatCount(tables.length)} table${tables.length === 1 ? "" : "s"} with ${formatCount(totalRows)} rows in total.

Largest tables:
${tableLines}${more}

Ask anything, or start from one of the questions below.`,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Seed the first render from the synchronous mirror so a refresh never flashes
  // the upload screen before IndexedDB and DuckDB finish restoring.
  const cached = useMemo<WorkspaceCache | null>(() => readWorkspaceCache(), []);
  const cachedSessions = useMemo(
    () => (cached?.sessions ?? []).map(normalizeSession),
    [cached],
  );

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>(cachedSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => cached?.activeSessionId ?? cachedSessions[0]?.id ?? null,
  );
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, ChatMessage[]>
  >(() => {
    const messages: Record<string, ChatMessage[]> = {};
    for (const session of cachedSessions) {
      messages[session.id] = normalizeMessages(
        cached?.messagesBySession?.[session.id],
      );
    }
    return messages;
  });
  const [tracesBySession, setTracesBySession] = useState<
    Record<string, ToolTraceEntry[]>
  >({});
  const [digestBySession, setDigestBySession] = useState<
    Record<string, DatasetDigest>
  >(() => cached?.digestBySession ?? {});
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(
    null,
  );
  const [upload, setUpload] = useState<UploadState>(IDLE_UPLOAD);
  const [sheetPicker, setSheetPicker] = useState<SheetPickerRequest | null>(
    null,
  );
  const [apiKey, setApiKey] = useState<string | null>(() => getStoredApiKey());
  const [model, setModelState] = useState<ModelId>(() => getStoredModel());
  const modelRef = useRef<ModelId>(model);
  modelRef.current = model;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [panelOpen, setPanelOpenState] = useState(() => getPanelOpen(true));
  const [panelTab, setPanelTabState] = useState<PanelTab>("notes");
  const [sidebarOpen, setSidebarOpenState] = useState(() =>
    getSidebarOpen(true),
  );
  const [pythonResult, setPythonResult] = useState<PythonExecutionResult | null>(null);
  const [pythonHistory, setPythonHistory] = useState<PythonExecutionResult[]>([]);
  const [pythonStatus, setPythonStatus] = useState<PythonStatus>('idle');

  useEffect(() => {
    return subscribePythonStatus(setPythonStatus);
  }, []);

  const dbHandleRef = useRef<DuckDBHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingSessionRef = useRef<string | null>(null);
  const persistReadyRef = useRef(false);
  const bootstrapRef = useRef<Promise<BootstrapResult> | null>(null);
  /** Original files kept in memory so "Open in Excel" never re-reads storage. */
  const fileCacheRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    let active = true;
    if (!bootstrapRef.current) bootstrapRef.current = bootstrapWorkspace();

    bootstrapRef.current
      .then((result) => {
        if (!active) return;
        dbHandleRef.current = result.handle;
        setSessions(result.sessions);
        setMessagesBySession(result.messagesBySession);
        setTracesBySession(result.tracesBySession);
        setDigestBySession(result.digestBySession);
        setActiveSessionId(result.activeSessionId);
        setDbReady(true);
        setDbError(null);
        persistReadyRef.current = true;
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDbError(errorMessage(error));
      });

    return () => {
      active = false;
    };
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const messages = useMemo(
    () => (activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []),
    [activeSessionId, messagesBySession],
  );

  const traces = useMemo(
    () => (activeSessionId ? (tracesBySession[activeSessionId] ?? []) : []),
    [activeSessionId, tracesBySession],
  );

  const digest = useMemo(
    () => (activeSessionId ? (digestBySession[activeSessionId] ?? null) : null),
    [activeSessionId, digestBySession],
  );

  const upsertTrace = useCallback(
    (sessionId: string, entry: ToolTraceEntry) => {
      setTracesBySession((previous) => {
        const list = previous[sessionId] ?? [];
        const existingIndex = list.findIndex((item) => item.id === entry.id);
        const nextList =
          existingIndex >= 0
            ? list.map((item, index) =>
                index === existingIndex ? entry : item,
              )
            : [...list, entry];
        return { ...previous, [sessionId]: nextList };
      });
    },
    [],
  );

  const patchMessage = useCallback(
    (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => {
      setMessagesBySession((previous) => {
        const list = previous[sessionId];
        if (!list) return previous;
        return {
          ...previous,
          [sessionId]: list.map((message) =>
            message.id === messageId ? { ...message, ...patch } : message,
          ),
        };
      });
    },
    [],
  );

  /** Builds a digest for a session and stores it for the agent and the UI. */
  const refreshDigest = useCallback(
    async (session: Session): Promise<DatasetDigest | null> => {
      const handle = dbHandleRef.current;
      if (!handle) return null;

      try {
        const next = await buildDatasetDigest(handle.connection, session);
        setDigestBySession((previous) => ({ ...previous, [session.id]: next }));
        return next;
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * Suggestion pass. Local heuristics land immediately (0ms, 0 tokens)
   * so follow-up options are always ready without draining API credits.
   */
  const refreshSuggestions = useCallback(
    async (
      session: Session,
      messageId: string,
      currentDigest: DatasetDigest | null,
      _question?: string,
      _answer?: string,
    ): Promise<void> => {
      try {
        const local = buildLocalSuggestions(session, currentDigest);
        patchMessage(session.id, messageId, {
          suggestions: local,
          suggestionsPending: false,
        });
      } catch {
        // Suggestions are optional. Never let them create an unhandled rejection.
        patchMessage(session.id, messageId, { suggestionsPending: false });
      }
    },
    [patchMessage],
  );

  const startUpload = useCallback(
    async (file: File, kind: FileKind, selectedSheets?: string[]) => {
      setUpload({
        phase: "reading",
        fileName: file.name,
        message: "Reading file…",
      });
      const startedAt = performance.now();

      try {
        let handle = dbHandleRef.current;
        if (!handle) {
          handle = await initDuckDB();
          dbHandleRef.current = handle;
          setDbReady(true);
          setDbError(null);
        }

        setUpload({
          phase: "ingesting",
          fileName: file.name,
          message: "Preparing your tables…",
        });

        const sessionId = createId();
        const result =
          kind === "csv"
            ? await ingestCSV({ handle, file, sessionId })
            : await ingestExcel({ handle, file, sessionId, selectedSheets });

        if (result.tables.length === 0) {
          throw new Error("No readable tables were found in this file.");
        }

        const session: Session = {
          id: sessionId,
          fileName: file.name,
          fileType: kind,
          fileSize: file.size,
          uploadedAt: Date.now(),
          schemaName: buildSchemaName(sessionId),
          tables: result.tables,
          primaryTable: result.primaryTable,
          selectedSheets,
        };

        fileCacheRef.current.set(sessionId, file);
        registerSession(session);

        // Digest first: the welcome message and every suggestion depend on it.
        setUpload({
          phase: "ingesting",
          fileName: file.name,
          message: "Reading columns…",
        });
        const nextDigest = await refreshDigest(session);

        const welcome = buildWelcomeMessage(
          session,
          buildLocalSuggestions(session, nextDigest),
        );

        setSessions((previous) => [session, ...previous]);
        setActiveSessionId(sessionId);
        setMessagesBySession((previous) => ({
          ...previous,
          [sessionId]: [welcome],
        }));
        setTracesBySession((previous) => ({ ...previous, [sessionId]: [] }));
        recordMetric("lastUploadMs", performance.now() - startedAt);
        setUpload({
          phase: "done",
          fileName: file.name,
          message: `Loaded ${result.tables.length} table${result.tables.length === 1 ? "" : "s"}.`,
        });

        await saveSessionFile(sessionId, file);
        void savePersistedSession({
          id: sessionId,
          session,
          messages: [welcome],
          traces: [],
          digest: nextDigest ?? undefined,
          updatedAt: Date.now(),
        }).catch(() => undefined);

        // Now let the model sharpen the starter questions.
        void refreshSuggestions(session, welcome.id, nextDigest).catch(
          () => undefined,
        );
      } catch (error) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: errorMessage(error),
        });
      }
    },
    [refreshDigest, refreshSuggestions],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const kind = getFileKind(file.name);
      if (!kind) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: `Unsupported file type. Upload ${ACCEPTED_EXTENSIONS.join(" or ")}.`,
        });
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: "File is too large for in-browser analysis (limit: 80 MB).",
        });
        return;
      }

      if (kind === "xlsx") {
        setUpload({
          phase: "reading",
          fileName: file.name,
          message: "Checking sheets…",
        });
        try {
          const sheets = await inspectWorkbookInWorker(
            await file.arrayBuffer(),
          );
          if (sheets.length > 25) {
            setSheetPicker({ file, fileName: file.name, sheets });
            setUpload(IDLE_UPLOAD);
            return;
          }
        } catch (error) {
          setUpload({
            phase: "error",
            fileName: file.name,
            message: errorMessage(error),
          });
          return;
        }
      }

      await startUpload(file, kind);
    },
    [startUpload],
  );

  const confirmSheetSelection = useCallback(
    async (sheetNames: string[]) => {
      const pending = sheetPicker;
      if (!pending) return;
      setSheetPicker(null);
      const selected = sheetNames.filter((name) =>
        pending.sheets.some((sheet) => sheet.name === name),
      );
      if (selected.length === 0) {
        setUpload({
          phase: "error",
          fileName: pending.fileName,
          message: "Select at least one sheet to continue.",
        });
        return;
      }
      await startUpload(pending.file, "xlsx", selected);
    },
    [sheetPicker, startUpload],
  );

  const cancelSheetSelection = useCallback(() => {
    setSheetPicker(null);
    setUpload(IDLE_UPLOAD);
  }, []);

  const replaceActiveFile = useCallback(
    async (file: File) => {
      const session = activeSession;
      if (!session) return;

      const kind = getFileKind(file.name);
      if (!kind) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: `Unsupported file type. Upload ${ACCEPTED_EXTENSIONS.join(" or ")}.`,
        });
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: "File is too large for in-browser analysis (limit: 80 MB).",
        });
        return;
      }

      setUpload({
        phase: "reading",
        fileName: file.name,
        message: "Reading file…",
      });
      const startedAt = performance.now();

      try {
        let handle = dbHandleRef.current;
        if (!handle) {
          handle = await initDuckDB();
          dbHandleRef.current = handle;
          setDbReady(true);
          setDbError(null);
        }

        setUpload({
          phase: "ingesting",
          fileName: file.name,
          message: "Preparing your tables…",
        });

        // Ingest into a temporary schema first, so a failed replacement leaves
        // the existing dataset untouched.
        const temporaryId = createId();
        const result =
          kind === "csv"
            ? await ingestCSV({ handle, file, sessionId: temporaryId })
            : await ingestExcel({ handle, file, sessionId: temporaryId });

        if (result.tables.length === 0) {
          throw new Error("No readable tables were found in this file.");
        }

        try {
          await handle.connection.query(
            `DROP SCHEMA IF EXISTS ${quoteIdent(session.schemaName)} CASCADE`,
          );
        } catch {
          // The old schema may already be gone.
        }

        const updated: Session = {
          ...session,
          fileName: file.name,
          fileType: kind,
          fileSize: file.size,
          uploadedAt: Date.now(),
          schemaName: buildSchemaName(temporaryId),
          tables: result.tables,
          primaryTable: result.primaryTable,
        };

        fileCacheRef.current.set(session.id, file);
        unregisterSession(session.id);
        registerSession(updated);
        setSessions((previous) =>
          previous.map((entry) => (entry.id === session.id ? updated : entry)),
        );
        setMessagesBySession((previous) => ({ ...previous, [session.id]: [] }));
        setTracesBySession((previous) => ({ ...previous, [session.id]: [] }));
        setDigestBySession((previous) => {
          const next = { ...previous };
          delete next[session.id];
          return next;
        });

        setUpload({
          phase: "ingesting",
          fileName: file.name,
          message: "Reading columns…",
        });
        const nextDigest = await refreshDigest(updated);
        const welcome = buildWelcomeMessage(
          updated,
          buildLocalSuggestions(updated, nextDigest),
        );
        setMessagesBySession((previous) => ({
          ...previous,
          [session.id]: [welcome],
        }));
        recordMetric("lastUploadMs", performance.now() - startedAt);
        setUpload({
          phase: "done",
          fileName: file.name,
          message: `Replaced with ${result.tables.length} table${result.tables.length === 1 ? "" : "s"}.`,
        });

        await saveSessionFile(session.id, file);
        void savePersistedSession({
          id: session.id,
          session: updated,
          messages: [welcome],
          traces: [],
          digest: nextDigest ?? undefined,
          updatedAt: Date.now(),
        }).catch(() => undefined);
        void refreshSuggestions(updated, welcome.id, nextDigest).catch(
          () => undefined,
        );
      } catch (error) {
        setUpload({
          phase: "error",
          fileName: file.name,
          message: errorMessage(error),
        });
      }
    },
    [activeSession, refreshDigest, refreshSuggestions],
  );

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    void saveActiveSessionId(sessionId).catch(() => undefined);
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (streamingSessionRef.current === sessionId) {
        abortRef.current?.abort();
        abortRef.current = null;
      }

      const target =
        sessions.find((session) => session.id === sessionId) ?? null;
      const remaining = sessions.filter((session) => session.id !== sessionId);

      unregisterSession(sessionId);
      fileCacheRef.current.delete(sessionId);
      void deletePersistedSession(sessionId).catch(() => undefined);

      setMessagesBySession((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });
      setTracesBySession((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });
      setDigestBySession((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });

      if (target && dbHandleRef.current) {
        try {
          await dbHandleRef.current.connection.query(
            `DROP SCHEMA IF EXISTS ${quoteIdent(target.schemaName)} CASCADE`,
          );
        } catch {
          // The schema may already be gone, or the DB may be shutting down.
        }
      }

      if (remaining.length === 0) {
        clearSessionRegistry();
        setSessions([]);
        setActiveSessionId(null);
        setMessagesBySession({});
        setTracesBySession({});
        setDigestBySession({});
        setIsStreaming(false);
        setStreamingSessionId(null);
        streamingSessionRef.current = null;
        setPanelOpenState(false);
        dbHandleRef.current = null;
        setDbReady(false);
        clearWorkspaceCache();
        void clearPersistedWorkspace().catch(() => undefined);
        await closeDuckDB();
        return;
      }

      const nextActiveId =
        activeSessionId === sessionId ? remaining[0].id : activeSessionId;
      setSessions(remaining);
      setActiveSessionId(nextActiveId);
      if (nextActiveId)
        void saveActiveSessionId(nextActiveId).catch(() => undefined);
    },
    [activeSessionId, sessions],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (text.length === 0) return;

      const session = activeSession;
      if (!session) return;

      if (!apiKey && NEEDS_ACCESS_KEY) {
        setSettingsOpen(true);
        return;
      }

      if (isStreaming || !dbHandleRef.current) return;

      const sessionId = session.id;
      const history = messagesBySession[sessionId] ?? [];
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const currentModel = modelRef.current;
      const assistantId = createId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        model: currentModel,
        createdAt: Date.now(),
      };

      setMessagesBySession((previous) => ({
        ...previous,
        [sessionId]: [
          ...(previous[sessionId] ?? []),
          userMessage,
          assistantMessage,
        ],
      }));
      setIsStreaming(true);
      setStreamingSessionId(sessionId);
      streamingSessionRef.current = sessionId;

      const controller = new AbortController();
      abortRef.current = controller;

      // Token deltas arrive many times per second. Coalescing them into one
      // render per animation frame keeps the stream smooth without dropping the
      // first characters on slower machines.
      let pendingDelta = "";
      let deltaFrame: number | null = null;

      const flushPendingDelta = () => {
        if (deltaFrame !== null) {
          window.cancelAnimationFrame(deltaFrame);
          deltaFrame = null;
        }
        if (pendingDelta.length === 0) return;

        const delta = pendingDelta;
        pendingDelta = "";
        setMessagesBySession((previous) => {
          const list = previous[sessionId] ?? [];
          return {
            ...previous,
            [sessionId]: list.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          };
        });
      };

      const scheduleDelta = (delta: string) => {
        pendingDelta += delta;
        if (deltaFrame !== null) return;
        deltaFrame = window.requestAnimationFrame(() => {
          deltaFrame = null;
          flushPendingDelta();
        });
      };

      try {
        const result = await runAgentTurn({
          apiKey: apiKey ?? "server-proxy",
          model: currentModel,
          session,
          digest: digestBySession[sessionId] ?? null,
          history,
          userText: text,
          signal: controller.signal,
          onDelta: scheduleDelta,
          onTrace: (entry) => upsertTrace(sessionId, entry),
        });

        // Drain the last buffered characters before replacing with the
        // authoritative final text.
        flushPendingDelta();
        patchMessage(sessionId, assistantId, {
          content: result.text,
          usage: result.usage,
        });

        // Follow-ups are derived from the question, the answer, and the data.
        void refreshSuggestions(
          session,
          assistantId,
          digestBySession[sessionId] ?? null,
          text,
          result.text,
        ).catch(() => undefined);
      } catch (error) {
        flushPendingDelta();
        if (controller.signal.aborted) {
          setMessagesBySession((previous) => {
            const list = previous[sessionId] ?? [];
            return {
              ...previous,
              [sessionId]: list.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      suggestionsPending: false,
                      content:
                        message.content.trim().length > 0
                          ? `${message.content}\n\n_Stopped._`
                          : "_Generation stopped._",
                    }
                  : message,
              ),
            };
          });
        } else {
          const message = errorMessage(error);
          setMessagesBySession((previous) => {
            const list = previous[sessionId] ?? [];
            return {
              ...previous,
              [sessionId]: list.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      error: true,
                      suggestionsPending: false,
                      content:
                        item.content.trim().length > 0
                          ? `${item.content}\n\n> **Agent error:** ${message}`
                          : `> **Agent error:** ${message}`,
                    }
                  : item,
              ),
            };
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingSessionId(null);
        streamingSessionRef.current = null;
        abortRef.current = null;
      }
    },
    [
      activeSession,
      apiKey,
      digestBySession,
      isStreaming,
      messagesBySession,
      model,
      patchMessage,
      refreshSuggestions,
      upsertTrace,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openReport = useCallback(() => setReportOpen(true), []);
  const closeReport = useCallback(() => setReportOpen(false), []);

  const saveApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    persistApiKey(trimmed);
    setApiKey(trimmed.length > 0 ? trimmed : null);
  }, []);

  const clearApiKey = useCallback(() => {
    persistClearApiKey();
    setApiKey(null);
  }, []);

  const setModel = useCallback((nextModel: ModelId) => {
    modelRef.current = nextModel;
    persistModel(nextModel);
    setModelState(nextModel);
  }, []);

  const openPanel = useCallback((tab: PanelTab = "notes") => {
    setPanelTabState(tab);
    setPanelOpenState(true);
    savePanelOpen(true);
    if (tab === 'python') preloadPythonEngine();
  }, []);

  const closePanel = useCallback((persist = true) => {
    setPanelOpenState(false);
    if (persist) savePanelOpen(false);
  }, []);

  const setPanelTab = useCallback((tab: PanelTab) => {
    setPanelTabState(tab);
    setPanelOpenState(true);
    savePanelOpen(true);
    if (tab === 'python') preloadPythonEngine();
  }, []);

  const setSidebarOpen = useCallback((open: boolean, persist = true) => {
    setSidebarOpenState(open);
    if (persist) saveSidebarOpen(open);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((previous) => {
      saveSidebarOpen(!previous);
      return !previous;
    });
  }, []);

  const exportTrace = useCallback(() => {
    const session = activeSession;
    if (!session) return;
    const sessionTraces = tracesBySession[session.id] ?? [];
    const blob = new Blob([buildTraceExport(session, sessionTraces)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = traceExportFileName(session);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [activeSession, tracesBySession]);

  const exportTranscript = useCallback(() => {
    const session = activeSession;
    if (!session) return;
    const sessionMessages = messagesBySession[session.id] ?? [];
    downloadTextFile(
      transcriptFileName(session),
      buildTranscript(session, sessionMessages),
    );
  }, [activeSession, messagesBySession]);

  const editFigure = useCallback(
    (messageId: string, figureIndex: number, changes: FigureChanges) => {
      const session = activeSession;
      if (!session) return;
      setMessagesBySession((previous) => {
        const list = previous[session.id];
        if (!list) return previous;
        return {
          ...previous,
          [session.id]: list.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  content: editFigureContent(
                    message.content,
                    figureIndex,
                    changes,
                  ),
                }
              : message,
          ),
        };
      });
    },
    [activeSession],
  );

  const renameSession = useCallback(
    (sessionId: string, fileName: string) => {
      const trimmed = fileName.trim();
      if (!trimmed) return;
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;

      const updated: Session = { ...target, fileName: trimmed };
      unregisterSession(sessionId);
      registerSession(updated);
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId ? updated : session,
        ),
      );
      void savePersistedSession({
        id: sessionId,
        session: updated,
        messages: messagesBySession[sessionId] ?? [],
        traces: tracesBySession[sessionId] ?? [],
        digest: digestBySession[sessionId],
        updatedAt: Date.now(),
      });
    },
    [digestBySession, messagesBySession, sessions, tracesBySession],
  );

  /**
   * Hands the original file back to the OS.
   *
   * A browser cannot spawn Excel, but it can download the exact bytes it was
   * given; the OS then opens the file with the registered spreadsheet app.
   */
  const openActiveFile = useCallback(async () => {
    const session = activeSession;
    if (!session) return;

    const cached = fileCacheRef.current.get(session.id);
    if (cached) {
      downloadFile(cached);
      return;
    }

    const stored = await loadSessionFile(session.id);
    if (!stored) return;
    fileCacheRef.current.set(session.id, stored);
    downloadFile(stored);
  }, [activeSession]);

  const runPythonCode = useCallback(
    async (code: string, options?: { openPanel?: boolean }): Promise<PythonExecutionResult> => {
      if (options?.openPanel) {
        setPanelOpenState(true);
        setPanelTabState('python');
      }

      const session = activeSession;
      const primaryTable = session?.primaryTable ?? session?.tables?.[0]?.name;

      try {
        const result = await runPython(code, {
          connection: dbHandleRef.current?.connection ?? null,
          schemaName: session?.schemaName,
          tableName: primaryTable,
        });
        setPythonResult(result);
        setPythonHistory((prev) => {
          // If previous top run is the exact same code, replace it instead of accumulating Run 1, 2, 3...
          if (prev.length > 0 && prev[0].code.trim() === code.trim()) {
            return [result, ...prev.slice(1)];
          }
          return [result, ...prev.slice(0, 4)];
        });
        return result;
      } catch (error) {
        const failedResult: PythonExecutionResult = {
          code,
          stdout: '',
          stderr: '',
          images: [],
          elapsedMs: 0,
          error: error instanceof Error ? error.message : 'Execution failed.',
          executedAt: Date.now(),
        };
        setPythonResult(failedResult);
        setPythonHistory((prev) => {
          if (prev.length > 0 && prev[0].code.trim() === code.trim()) {
            return [failedResult, ...prev.slice(1)];
          }
          return [failedResult, ...prev.slice(0, 4)];
        });
        return failedResult;
      }
    },
    [activeSession],
  );

  const clearPythonResult = useCallback(() => {
    resetPythonEngine();
    setPythonResult(null);
    setPythonHistory([]);
  }, []);

  useWorkspacePersistence({
    ready: persistReadyRef,
    sessions,
    activeSessionId,
    messagesBySession,
    tracesBySession,
    digestBySession,
    isStreaming,
  });

  const state = useMemo<SessionState>(
    () => ({
      dbReady,
      dbError,
      sessions,
      activeSession,
      messages,
      traces,
      digest,
      isStreaming,
      streamingSessionId,
      upload,
      apiKey,
      model,
      settingsOpen,
      reportOpen,
      panelOpen,
      panelTab,
      sidebarOpen,
      sheetPicker,
      pythonResult,
      pythonHistory,
      pythonStatus,
    }),
    [
      activeSession,
      apiKey,
      dbError,
      dbReady,
      digest,
      isStreaming,
      messages,
      model,
      panelOpen,
      panelTab,
      pythonResult,
      pythonHistory,
      pythonStatus,
      reportOpen,
      sessions,
      settingsOpen,
      sheetPicker,
      sidebarOpen,
      streamingSessionId,
      traces,
      upload,
    ],
  );

  // Stable for the lifetime of the provider: action-only consumers never re-render.
  const actions = useMemo<SessionActions>(
    () => ({
      uploadFile,
      selectSession,
      deleteSession,
      sendMessage,
      stopStreaming,
      openSettings,
      closeSettings,
      openReport,
      closeReport,
      saveApiKey,
      clearApiKey,
      setModel,
      openPanel,
      closePanel,
      setPanelTab,
      setSidebarOpen,
      toggleSidebar,
      exportTrace,
      exportTranscript,
      renameSession,
      replaceActiveFile,
      editFigure,
      confirmSheetSelection,
      cancelSheetSelection,
      openActiveFile,
      runPythonCode,
      clearPythonResult,
    }),
    [
      cancelSheetSelection,
      clearApiKey,
      clearPythonResult,
      closePanel,
      closeReport,
      closeSettings,
      confirmSheetSelection,
      deleteSession,
      editFigure,
      exportTrace,
      exportTranscript,
      renameSession,
      replaceActiveFile,
      openActiveFile,
      openPanel,
      openReport,
      openSettings,
      runPythonCode,
      saveApiKey,
      selectSession,
      sendMessage,
      setModel,
      setPanelTab,
      setSidebarOpen,
      stopStreaming,
      toggleSidebar,
      uploadFile,
    ],
  );

  return (
    <SessionActionsContext.Provider value={actions}>
      <SessionStateContext.Provider value={state}>
        {children}
      </SessionStateContext.Provider>
    </SessionActionsContext.Provider>
  );
}
