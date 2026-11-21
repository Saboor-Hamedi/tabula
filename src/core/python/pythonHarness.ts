/**
 * Shared Pyodide execution harness.
 *
 * Isolates all Python-side safety wrappers (auto-header promotion, duplicate-column
 * coalescing, KeyError-safe column access, virtual multi-file `dfs`, matplotlib
 * editorial styling, and non-finite axis limit guards) in one module.
 */

export const PYTHON_HARNESS = `
import sys, io, os, re, base64, traceback, math, ast
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.axes import Axes as _MplAxes
import pandas as pd
from pandas.core.groupby.generic import SeriesGroupBy as _SeriesGroupBy, DataFrameGroupBy as _DataFrameGroupBy
import numpy as np

plt.rcParams.update({
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.edgecolor': '#cbd5e1',
    'axes.linewidth': 0.9,
    'axes.grid': True,
    'axes.axisbelow': True,
    'grid.alpha': 0.35,
    'grid.color': '#e2e8f0',
    'grid.linestyle': '--',
    'figure.facecolor': '#ffffff',
    'axes.facecolor': '#ffffff',
    'axes.prop_cycle': matplotlib.cycler(
        color=['#2563eb', '#0d9488', '#f59e0b', '#e11d48', '#7c3aed', '#0284c7']
    ),
    'font.size': 9.5,
    'axes.titlesize': 11,
    'axes.titleweight': 'bold',
    'axes.labelsize': 9.5,
    'xtick.labelsize': 9,
    'ytick.labelsize': 9,
    'figure.figsize': (7.2, 3.8),
})

# Silent no-op so scripts calling plt.show() never emit FigureCanvasAgg warnings
# and figures remain open for capture into the UI.
plt.show = lambda *args, **kwargs: None

def _sanitize_lim_arg(val):
    if val is None:
        return None
    if isinstance(val, (int, float, np.floating, np.integer)):
        f = float(val)
        return f if math.isfinite(f) else None
    return val

_orig_set_ylim = _MplAxes.set_ylim
def _safe_set_ylim(self, bottom=None, top=None, *, emit=True, auto=False, ymin=None, ymax=None):
    if isinstance(bottom, (tuple, list, np.ndarray)) and len(bottom) == 2 and top is None:
        bottom, top = bottom[0], bottom[1]
    if ymin is not None and bottom is None:
        bottom = ymin
    if ymax is not None and top is None:
        top = ymax
    b = _sanitize_lim_arg(bottom)
    t = _sanitize_lim_arg(top)
    if b is None and t is None and (bottom is not None or top is not None):
        return self.get_ylim()
    return _orig_set_ylim(self, bottom=b, top=t, emit=emit, auto=auto)

_orig_set_xlim = _MplAxes.set_xlim
def _safe_set_xlim(self, left=None, right=None, *, emit=True, auto=False, xmin=None, xmax=None):
    if isinstance(left, (tuple, list, np.ndarray)) and len(left) == 2 and right is None:
        left, right = left[0], left[1]
    if xmin is not None and left is None:
        left = xmin
    if xmax is not None and right is None:
        right = xmax
    l = _sanitize_lim_arg(left)
    r = _sanitize_lim_arg(right)
    if l is None and r is None and (left is not None or right is not None):
        return self.get_xlim()
    return _orig_set_xlim(self, left=l, right=r, emit=emit, auto=auto)

_MplAxes.set_ylim = _safe_set_ylim
_MplAxes.set_xlim = _safe_set_xlim

class _TabulaDataFrames(dict):
    """Canonical dict of uploaded DataFrames with smart alias & fuzzy lookup."""
    _STOP_TOKENS = frozenset({'src', 'df', 'data', 'table', 'sheet', 'csv', 'xlsx', 'xls'})

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._aliases = {}
        for k in list(self.keys()):
            self._index_key(k)

    def _index_key(self, key):
        ks = str(key)
        base = os.path.basename(ks)
        stem = os.path.splitext(base)[0]
        for variant in (ks, ks.lower(), base, base.lower(), stem, stem.lower()):
            if variant and variant not in self._aliases:
                self._aliases[variant] = key
        norm = re.sub(r'[^a-z0-9]+', '', stem.lower())
        if norm and norm not in self._aliases:
            self._aliases[norm] = key

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self._index_key(key)

    def _resolve(self, key):
        if super().__contains__(key):
            return key
        ks = str(key).strip()
        low = ks.lower()
        base = os.path.basename(ks).lower()
        stem = os.path.splitext(base)[0]
        for candidate in (ks, low, base, stem):
            if candidate in self._aliases and super().__contains__(self._aliases[candidate]):
                return self._aliases[candidate]
        norm = re.sub(r'[^a-z0-9]+', '', low)
        norm_trimmed = re.sub(r'(src|df|data)$', '', norm)
        for n in (norm, norm_trimmed):
            if n and n in self._aliases and super().__contains__(self._aliases[n]):
                return self._aliases[n]
        tokens = [t for t in re.split(r'[^a-z0-9]+', low) if t and t not in self._STOP_TOKENS]
        if tokens:
            matches = []
            for canonical in self.keys():
                c_tokens = set(re.split(r'[^a-z0-9]+', str(canonical).lower()))
                if all(t in c_tokens for t in tokens):
                    matches.append(canonical)
            if matches:
                return matches[0]
        return None

    def __contains__(self, key):
        return self._resolve(key) is not None

    def __getitem__(self, key):
        resolved = self._resolve(key)
        if resolved is None:
            raise KeyError(f"{key!r} not found in dfs. Available keys: {list(self.keys())}")
        return super().__getitem__(resolved)

    def get(self, key, default=None):
        resolved = self._resolve(key)
        if resolved is None:
            return default
        return super().__getitem__(resolved)

_orig_read_excel = pd.read_excel
_orig_read_csv = pd.read_csv

def _tabula_resolve_virtual_df(io_arg):
    if isinstance(io_arg, (str, os.PathLike)):
        path_str = os.fspath(io_arg)
        dfs_obj = globals().get('dfs')
        vfiles = globals().get('__tabula_virtual_files__', set())
        if isinstance(dfs_obj, dict):
            base = os.path.basename(path_str)
            if path_str in vfiles or base in vfiles or not os.path.exists(path_str):
                if path_str in dfs_obj:
                    return dfs_obj[path_str].copy()
                if base in dfs_obj:
                    return dfs_obj[base].copy()
    return None

def _tabula_read_excel(io_arg, *args, **kwargs):
    matched = _tabula_resolve_virtual_df(io_arg)
    if matched is not None:
        return matched
    return _orig_read_excel(io_arg, *args, **kwargs)

def _tabula_read_csv(io_arg, *args, **kwargs):
    matched = _tabula_resolve_virtual_df(io_arg)
    if matched is not None:
        return matched
    return _orig_read_csv(io_arg, *args, **kwargs)

pd.read_excel = _tabula_read_excel
pd.read_csv = _tabula_read_csv

def _coalesce_series(frame):
    s = frame.iloc[:, 0]
    for i in range(1, frame.shape[1]):
        s = s.combine_first(frame.iloc[:, i])
    return s

def _dedup_df_cols(frame):
    if not isinstance(frame, pd.DataFrame) or not frame.columns.has_duplicates:
        return frame
    seen = {}
    order = []
    for idx, col in enumerate(frame.columns):
        if col not in seen:
            seen[col] = [idx]
            order.append(col)
        else:
            seen[col].append(idx)
    data = {}
    for col in order:
        idxs = seen[col]
        s = frame.iloc[:, idxs[0]]
        for idx in idxs[1:]:
            s = s.combine_first(frame.iloc[:, idx])
        data[col] = s
    return pd.DataFrame(data, index=frame.index)

def _is_number_text(text):
    try:
        float(text)
        return True
    except Exception:
        return False

def _normalize_banner_df(frame, source_hint=None):
    """Promote embedded header rows when a table has generic column_2, column_3... headers."""
    if not isinstance(frame, pd.DataFrame) or frame.shape[1] < 3 or len(frame) < 2:
        return frame
    tail_cols = [str(c) for c in frame.columns[1:]]
    generic_count = sum(1 for c in tail_cols if re.match(r'^column_\\d+$', c, flags=re.I))
    if generic_count < max(2, math.ceil(len(tail_cols) * 0.5)):
        return frame

    min_cells = max(3, math.ceil(frame.shape[1] * 0.5))
    scan_limit = min(5, len(frame))
    header_idx = None
    for r in range(scan_limit):
        row_vals = frame.iloc[r].tolist()
        non_empty = []
        non_numeric_strings = 0
        for val in row_vals:
            if val is None:
                continue
            try:
                if pd.isna(val):
                    continue
            except Exception:
                pass
            s = str(val).strip()
            if not s:
                continue
            non_empty.append(s)
            if not _is_number_text(s):
                non_numeric_strings += 1
        if len(non_empty) >= min_cells and non_numeric_strings >= math.ceil(len(non_empty) * 0.6):
            header_idx = r
            break

    if header_idx is None:
        return frame

    raw_headers = frame.iloc[header_idx].tolist()
    used_names = set()
    clean_cols = []
    for idx, val in enumerate(raw_headers):
        s = ''
        if val is not None:
            try:
                if not pd.isna(val):
                    s = str(val).strip()
            except Exception:
                s = str(val).strip()
        base = s if s else f'column_{idx + 1}'
        name = base
        suffix = 2
        while name in used_names:
            name = f'{base}_{suffix}'
            suffix += 1
        used_names.add(name)
        clean_cols.append(name)

    promoted = frame.iloc[header_idx + 1:].reset_index(drop=True).copy()
    promoted.columns = clean_cols

    first_col = str(frame.columns[0]).strip()
    banner_text = None
    if first_col and not re.match(r'^column_\\d+$', first_col, flags=re.I):
        banner_text = first_col
    else:
        for b in range(header_idx):
            for cell in frame.iloc[b].tolist():
                if cell is not None:
                    try:
                        if pd.isna(cell):
                            continue
                    except Exception:
                        pass
                    cs = str(cell).strip()
                    if cs:
                        banner_text = cs
                        break
            if banner_text:
                break
        if not banner_text and source_hint:
            banner_text = os.path.splitext(os.path.basename(str(source_hint)))[0]

    if banner_text:
        norm_text = re.sub(r'[_\\s]+', ' ', banner_text).strip()
        m = re.match(r'^([A-Za-z][A-Za-z0-9 _-]{1,20}?)[:\\s-]+([A-Za-z0-9._-]+)$', norm_text)
        if m:
            grp_col = m.group(1).strip().title()
            grp_val = m.group(2).strip().upper()
        else:
            grp_col = 'Source Group'
            grp_val = norm_text
        existing_norm = {re.sub(r'[\\s_]+', ' ', str(c).strip()).lower() for c in promoted.columns}
        if re.sub(r'[\\s_]+', ' ', grp_col.strip()).lower() not in existing_norm:
            promoted.insert(0, grp_col, grp_val)

    return _dedup_df_cols(promoted)

def _resolve_col_name(frame, key):
    if not isinstance(frame, pd.DataFrame) or not isinstance(key, str):
        return None
    if key in frame.columns:
        return key
    target_norm = re.sub(r'[\\s_]+', ' ', key.strip()).lower()
    if not target_norm:
        return None
    for col in frame.columns:
        if re.sub(r'[\\s_]+', ' ', str(col).strip()).lower() == target_norm:
            return col
    tokens = [t for t in re.split(r'[^a-z0-9]+', target_norm) if t]
    if tokens:
        matches = []
        for col in frame.columns:
            col_norm = re.sub(r'[\\s_]+', ' ', str(col).strip()).lower()
            col_tokens = set(re.split(r'[^a-z0-9]+', col_norm))
            if all(t in col_tokens for t in tokens):
                matches.append(col)
        if len(matches) == 1:
            return matches[0]
    return None

def safe_get_column(df, column_name, default=None):
    """Safely look up a column by exact or normalized name without raising KeyError."""
    resolved = _resolve_col_name(df, column_name)
    if resolved is not None:
        res = _orig_df_getitem(df, resolved)
        return _coalesce_series(res) if isinstance(res, pd.DataFrame) else res
    print(f"Column '{column_name}' not found in DataFrame. Available: {list(df.columns)}")
    return default

def plot_top_classes(df, performance_column='Total', class_column='Class', top_n=10, as_pct=False):
    """Plot top groups by mean performance with direct value/percentage labels on bars."""
    perf_col = _resolve_col_name(df, performance_column)
    cls_col = _resolve_col_name(df, class_column)
    if perf_col is None or cls_col is None:
        print(f"One or both columns '{performance_column}' and '{class_column}' not found in DataFrame.")
        return None
    work = pd.DataFrame({
        'group': _orig_df_getitem(df, cls_col).astype(str).str.strip(),
        'val': pd.to_numeric(_orig_df_getitem(df, perf_col), errors='coerce'),
    }).dropna()
    if len(work) == 0:
        print(f"No valid numeric values in '{perf_col}' for '{cls_col}'.")
        return None
    top = work.groupby('group')['val'].mean().nlargest(int(top_n))
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    bars = ax.bar(top.index.astype(str), top.values, color='#2563eb', edgecolor='none', width=0.58)
    for bar, val in zip(bars, top.values):
        label = f"{val:.1f}%" if as_pct else f"{val:.1f}"
        ax.text(bar.get_x() + bar.get_width() / 2, val, label, ha='center', va='bottom', fontsize=8.5, fontweight='bold')
    ax.set_title(f"Top {len(top)} {cls_col} by {perf_col}")
    ax.set_xlabel(cls_col)
    ax.set_ylabel(perf_col)
    plt.xticks(rotation=25, ha='right')
    plt.tight_layout()
    return top

_orig_concat = pd.concat
def _safe_concat(objs, *args, **kwargs):
    if isinstance(objs, dict):
        clean_objs = {k: _dedup_df_cols(v) for k, v in objs.items()}
    else:
        clean_objs = [_dedup_df_cols(o) for o in objs]
    res = _orig_concat(clean_objs, *args, **kwargs)
    return _dedup_df_cols(res) if isinstance(res, pd.DataFrame) else res

_orig_df_rename = pd.DataFrame.rename
def _safe_df_rename(self, *args, **kwargs):
    col_map = kwargs.get('columns')
    if col_map is None and len(args) > 0 and isinstance(args[0], dict):
        col_map = args[0]
    if (
        not kwargs.get('inplace')
        and isinstance(col_map, dict)
        and len(self.columns) >= 3
        and str(self.columns[1]) == 'column_2'
        and self.columns[0] in col_map
        and str(self.columns[0]).lower() != 'column_1'
    ):
        first_col = self.columns[0]
        new_name = col_map[first_col]
        if isinstance(new_name, str) and new_name not in self.columns:
            prefix_pat = r'^' + re.escape(new_name.strip()) + r'[_\\s:-]*'
            banner_val = re.sub(prefix_pat, '', str(first_col), flags=re.I).strip('_- ') or str(first_col)
            out = self.copy()
            out.insert(0, new_name, banner_val)
            rest_map = {k: v for k, v in col_map.items() if k != first_col}
            if rest_map:
                out = _orig_df_rename(out, columns=rest_map)
            return _dedup_df_cols(out)
    res = _orig_df_rename(self, *args, **kwargs)
    if res is None:
        return None
    return _dedup_df_cols(res) if isinstance(res, pd.DataFrame) else res

_orig_df_groupby = pd.DataFrame.groupby
def _safe_df_groupby(self, *args, **kwargs):
    target = _dedup_df_cols(self) if self.columns.has_duplicates else self
    return _orig_df_groupby(target, *args, **kwargs)

_orig_df_sort_values = pd.DataFrame.sort_values
def _safe_df_sort_values(self, *args, **kwargs):
    target = _dedup_df_cols(self) if self.columns.has_duplicates else self
    return _orig_df_sort_values(target, *args, **kwargs)

_orig_df_getitem = pd.DataFrame.__getitem__
def _safe_df_getitem(self, key):
    if isinstance(key, str):
        resolved = _resolve_col_name(self, key)
        if resolved is None:
            print(f"Warning: Column {key!r} not found (available: {list(self.columns)}). Returning NaN series.")
            return pd.Series(np.nan, index=self.index, name=key, dtype='object')
        res = _orig_df_getitem(self, resolved)
        return _coalesce_series(res) if isinstance(res, pd.DataFrame) else res
    if isinstance(key, (int, np.integer)) and key not in self.columns:
        idx = int(key)
        if -self.shape[1] <= idx < self.shape[1]:
            res = self.iloc[:, idx]
            return _coalesce_series(res) if isinstance(res, pd.DataFrame) else res
        return pd.Series(np.nan, index=self.index, name=str(key), dtype='object')
    if isinstance(key, list) and len(key) > 0 and all(isinstance(k, (str, int, np.integer)) for k in key):
        out = pd.DataFrame(index=self.index)
        all_exact_str = True
        for k in key:
            if isinstance(k, str) and k in self.columns:
                continue
            all_exact_str = False
            break
        if all_exact_str:
            return _orig_df_getitem(self, key)
        for orig_k in key:
            if isinstance(orig_k, str):
                r = _resolve_col_name(self, orig_k)
                if r is not None:
                    col_val = _orig_df_getitem(self, r)
                    out[orig_k] = _coalesce_series(col_val) if isinstance(col_val, pd.DataFrame) else col_val
                else:
                    out[orig_k] = np.nan
            elif isinstance(orig_k, (int, np.integer)):
                if orig_k in self.columns:
                    col_val = _orig_df_getitem(self, orig_k)
                    out[orig_k] = _coalesce_series(col_val) if isinstance(col_val, pd.DataFrame) else col_val
                elif -self.shape[1] <= int(orig_k) < self.shape[1]:
                    col_name = self.columns[int(orig_k)]
                    out[col_name] = self.iloc[:, int(orig_k)]
                else:
                    out[orig_k] = np.nan
        return out
    try:
        res = _orig_df_getitem(self, key)
        if isinstance(key, str) and isinstance(res, pd.DataFrame):
            return _coalesce_series(res)
        return res
    except (KeyError, IndexError):
        return pd.Series(np.nan, index=self.index, name=str(key), dtype='object')

_orig_series_getitem = pd.Series.__getitem__
def _safe_series_getitem(self, key):
    try:
        return _orig_series_getitem(self, key)
    except (KeyError, IndexError):
        if isinstance(key, (int, np.integer)):
            idx = int(key)
            if -len(self) <= idx < len(self):
                return self.iloc[idx]
        return np.nan

_orig_df_get = pd.DataFrame.get
def _safe_df_get(self, key, default=None):
    if isinstance(key, str):
        resolved = _resolve_col_name(self, key)
        if resolved is None:
            return default
        res = _orig_df_getitem(self, resolved)
        return _coalesce_series(res) if isinstance(res, pd.DataFrame) else res
    return _orig_df_get(self, key, default)

_orig_to_numeric = pd.to_numeric
def _safe_to_numeric(arg, *args, **kwargs):
    if isinstance(arg, pd.DataFrame):
        arg = _coalesce_series(arg)
    return _orig_to_numeric(arg, *args, **kwargs)

_orig_df_to_excel = pd.DataFrame.to_excel
def _tracked_to_excel(self, *args, **kwargs):
    if isinstance(self, pd.DataFrame) and len(self) > 0:
        prev = globals().get('__tabula_exported_df__')
        if prev is None or len(self) >= len(prev):
            globals()['__tabula_exported_df__'] = self
    return _orig_df_to_excel(self, *args, **kwargs)

_orig_df_to_csv = pd.DataFrame.to_csv
def _tracked_to_csv(self, path_or_buf=None, *args, **kwargs):
    if path_or_buf is not None and isinstance(self, pd.DataFrame) and len(self) > 0:
        prev = globals().get('__tabula_exported_df__')
        if prev is None or len(self) >= len(prev):
            globals()['__tabula_exported_df__'] = self
    return _orig_df_to_csv(self, path_or_buf, *args, **kwargs)

_orig_series_groupby_agg = _SeriesGroupBy.aggregate
def _safe_series_groupby_agg(self, func=None, *args, engine=None, engine_kwargs=None, **kwargs):
    if kwargs:
        clean_kwargs = {}
        for k, v in kwargs.items():
            if isinstance(v, (tuple, list)) and len(v) == 2:
                clean_kwargs[k] = v[1]
            else:
                clean_kwargs[k] = v
        kwargs = clean_kwargs
    return _orig_series_groupby_agg(self, func, *args, engine=engine, engine_kwargs=engine_kwargs, **kwargs)

_orig_df_groupby_agg = _DataFrameGroupBy.aggregate
def _safe_df_groupby_agg(self, func=None, *args, engine=None, engine_kwargs=None, **kwargs):
    if kwargs and isinstance(getattr(self, 'obj', None), pd.DataFrame):
        obj = self.obj
        num_cols = list(obj.select_dtypes(include='number').columns)
        fallback_col = num_cols[0] if num_cols else (obj.columns[0] if len(obj.columns) > 0 else None)
        clean_kwargs = {}
        for k, v in kwargs.items():
            if isinstance(v, (tuple, list)) and len(v) == 2:
                col_ref, agg_fn = v[0], v[1]
                if isinstance(col_ref, str):
                    resolved = _resolve_col_name(obj, col_ref)
                    if resolved is None:
                        print(f"Warning: Column {col_ref!r} not found in groupby agg; using NaN.")
                        obj[col_ref] = np.nan
                        resolved = col_ref
                    clean_kwargs[k] = (resolved, agg_fn)
                else:
                    clean_kwargs[k] = v
            elif fallback_col is not None and (isinstance(v, str) or callable(v)):
                clean_kwargs[k] = (fallback_col, v)
            else:
                clean_kwargs[k] = v
        kwargs = clean_kwargs
    return _orig_df_groupby_agg(self, func, *args, engine=engine, engine_kwargs=engine_kwargs, **kwargs)

pd.concat = _safe_concat
pd.DataFrame.rename = _safe_df_rename
pd.DataFrame.groupby = _safe_df_groupby
pd.DataFrame.sort_values = _safe_df_sort_values
pd.DataFrame.__getitem__ = _safe_df_getitem
pd.DataFrame.get = _safe_df_get
pd.Series.__getitem__ = _safe_series_getitem
_SeriesGroupBy.aggregate = _safe_series_groupby_agg
_SeriesGroupBy.agg = _safe_series_groupby_agg
_DataFrameGroupBy.aggregate = _safe_df_groupby_agg
_DataFrameGroupBy.agg = _safe_df_groupby_agg
pd.to_numeric = _safe_to_numeric
pd.DataFrame.to_excel = _tracked_to_excel
pd.DataFrame.to_csv = _tracked_to_csv

def _clean_plot_text(s):
    if not isinstance(s, str) or not s:
        return s
    # Remove (n=12), (N = 12), [n=12] sample count noise from figure labels and titles
    cleaned = re.sub(r'\\s*[\\(\\[]\\s*[nN]\\s*=\\s*\\d+\\s*[\\)\\]]', '', s)
    # Round long decimals inside figure annotations (e.g. 94.44443% -> 94.4%)
    def _round_match(m):
        prefix = m.group(1) or ''
        num_str = m.group(2)
        suffix = m.group(3) or ''
        try:
            v = float(num_str)
            if v.is_integer():
                return f"{prefix}{int(v)}{suffix}"
            return f"{prefix}{v:.1f}{suffix}"
        except Exception:
            return m.group(0)
    cleaned = re.sub(r'(^|[^\\d.])(-?\\d+\\.\\d{2,})(%?)', _round_match, cleaned)
    return cleaned.strip()

def _polish_figure(fig):
    try:
        if getattr(fig, '_suptitle', None) is not None:
            fig._suptitle.set_text(_clean_plot_text(fig._suptitle.get_text()))
        for ax in fig.get_axes():
            ax.set_axisbelow(True)
            if 'top' in ax.spines:
                ax.spines['top'].set_visible(False)
            if 'right' in ax.spines:
                ax.spines['right'].set_visible(False)
            ax.set_title(_clean_plot_text(ax.get_title()), pad=10)
            ax.set_xlabel(_clean_plot_text(ax.get_xlabel()))
            ax.set_ylabel(_clean_plot_text(ax.get_ylabel()))
            try:
                xt_objs = ax.get_xticklabels()
                xt = [ _clean_plot_text(t.get_text()) for t in xt_objs ]
                if any(xt):
                    ax.set_xticklabels(xt)
                non_empty_xt = [s for s in xt if s]
                has_category_names = any(not _is_number_text(s) or len(s) > 4 for s in non_empty_xt)
                if len(non_empty_xt) >= 2 and has_category_names:
                    for t in ax.get_xticklabels():
                        if t.get_rotation() == 0:
                            t.set_rotation(25)
                            t.set_ha('right')
                            t.set_rotation_mode('anchor')
            except Exception:
                pass
            try:
                yt = [ _clean_plot_text(t.get_text()) for t in ax.get_yticklabels() ]
                if any(yt):
                    ax.set_yticklabels(yt)
            except Exception:
                pass
            max_text_y = None
            for txt in ax.texts:
                txt.set_text(_clean_plot_text(txt.get_text()))
                try:
                    _, ty = txt.get_position()
                    if isinstance(ty, (int, float, np.floating)) and math.isfinite(float(ty)):
                        if max_text_y is None or float(ty) > max_text_y:
                            max_text_y = float(ty)
                except Exception:
                    pass
            if max_text_y is not None:
                try:
                    y0, y1 = ax.get_ylim()
                    if y1 > y0 and max_text_y >= y1 * 0.92:
                        ax.set_ylim(y0, max(y1, max_text_y) * 1.12)
                except Exception:
                    pass
    except Exception:
        pass

def _format_cell(val):
    if val is None:
        return ''
    if isinstance(val, (list, tuple, dict, set, np.ndarray)):
        return str(val)
    try:
        if pd.isna(val):
            return ''
    except Exception:
        pass
    if isinstance(val, (bool, np.bool_)):
        return str(val)
    if isinstance(val, (int, np.integer)):
        return str(int(val))
    if isinstance(val, (float, np.floating)):
        fval = float(val)
        if not math.isfinite(fval):
            return ''
        if fval.is_integer():
            return str(int(fval))
        return f"{fval:.1f}"
    s = str(val).strip()
    if re.match(r'^-?\\d+\\.\\d{2,}$', s):
        try:
            fval = float(s)
            return str(int(fval)) if fval.is_integer() else f"{fval:.1f}"
        except Exception:
            pass
    return s

def __tabula_run__(user_code, csv_content=None, extra_csvs=None):
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = stdout_io = io.StringIO()
    sys.stderr = stderr_io = io.StringIO()
    
    output_images = []
    execution_error = None
    df_info = None
    df_csv = None
    df_preview = None
    
    try:
        if csv_content is not None and len(csv_content) > 0:
            # Preserve DataFrame across consecutive runs on same data, reload if CSV changed
            if 'df' not in globals() or globals().get('__tabula_last_csv__') != csv_content:
                _loaded_df = _orig_read_csv(io.StringIO(csv_content), skip_blank_lines=False)
                globals()['df'] = _normalize_banner_df(_loaded_df)
                globals()['__tabula_last_csv__'] = csv_content

        if extra_csvs is not None:
            _dfs = _TabulaDataFrames()
            _vfiles = globals().get('__tabula_virtual_files__')
            if not isinstance(_vfiles, set):
                _vfiles = set()
            _extra_dict = extra_csvs.to_py() if hasattr(extra_csvs, 'to_py') else dict(extra_csvs)
            for _k, _v in _extra_dict.items():
                if _v is not None and len(_v) > 0:
                    _key_str = str(_k)
                    _parsed_extra = _orig_read_csv(io.StringIO(_v), skip_blank_lines=False)
                    _dfs[_key_str] = _normalize_banner_df(_parsed_extra, source_hint=_key_str)
                    # Register virtual file marker in CWD so glob.glob/os.listdir find uploaded files
                    _safe_name = os.path.basename(_key_str).replace('/', '_').replace('\\\\', '_')
                    if _safe_name:
                        _low_safe = _safe_name.lower()
                        _vname = _safe_name if _low_safe.endswith(('.xlsx', '.xls', '.csv')) else f"{_safe_name}.xlsx"
                        for _alias in (_safe_name, _low_safe, _vname, _vname.lower()):
                            _dfs._aliases[_alias] = _key_str
                        if not os.path.exists(_vname) or _vname in _vfiles:
                            try:
                                with open(_vname, 'wb') as _fh:
                                    _fh.write(b'')
                                _vfiles.add(_vname)
                            except Exception:
                                pass
            globals()['__tabula_virtual_files__'] = _vfiles
            globals()['dfs'] = _dfs
            if 'df' not in globals() and len(_dfs) > 0:
                globals()['df'] = next(iter(_dfs.values()))
            
        plt.close('all')

        _initial_df = globals().get('df')
        _initial_df_id = id(_initial_df)
        _initial_shape = _initial_df.shape if isinstance(_initial_df, pd.DataFrame) else None
        _initial_cols = list(_initial_df.columns) if isinstance(_initial_df, pd.DataFrame) else None
        _before_dfs = {
            _k: id(_v)
            for _k, _v in list(globals().items())
            if not _k.startswith('_') and isinstance(_v, (pd.DataFrame, pd.Series))
        }
        globals().pop('__tabula_exported_df__', None)
        _preview_df_override = None

        # Execute user code; if the final statement is a bare expression (like df.head(10)), capture its value
        _parsed_tree = None
        try:
            _parsed_tree = ast.parse(user_code, '<input>', 'exec')
        except Exception:
            _parsed_tree = None

        if _parsed_tree and len(_parsed_tree.body) > 0 and isinstance(_parsed_tree.body[-1], ast.Expr):
            _last_node = _parsed_tree.body[-1]
            _prefix_mod = ast.Module(body=_parsed_tree.body[:-1], type_ignores=[])
            if len(_prefix_mod.body) > 0:
                exec(compile(_prefix_mod, '<input>', 'exec'), globals())
            _expr_mod = ast.Expression(body=_last_node.value)
            _last_val = eval(compile(_expr_mod, '<input>', 'eval'), globals())
            if isinstance(_last_val, pd.DataFrame) and len(_last_val) > 0:
                _preview_df_override = _last_val
            elif isinstance(_last_val, pd.Series) and len(_last_val) > 0:
                _preview_df_override = _last_val.reset_index()
        else:
            compiled = compile(user_code, '<input>', 'exec')
            exec(compiled, globals())

        # If script produced a merged/output frame without reassigning df, promote it
        _current_df = globals().get('df')
        _df_unchanged = (
            _current_df is None
            or (
                id(_current_df) == _initial_df_id
                and isinstance(_current_df, pd.DataFrame)
                and _current_df.shape == _initial_shape
                and list(_current_df.columns) == _initial_cols
            )
        )
        _promoted = None
        if _df_unchanged:
            _exported = globals().get('__tabula_exported_df__')
            if isinstance(_exported, pd.DataFrame) and len(_exported) > 0:
                _promoted = _exported
            else:
                for _cand in (
                    'out', 'merged', 'combined', 'all_classes', 'all_data',
                    'master', 'result_df', 'final_df', 'cleaned', 'summary',
                    'summary_df', 'grouped', 'stats', 'top_df', 'table_df',
                ):
                    _val = globals().get(_cand)
                    if isinstance(_val, pd.DataFrame) and len(_val) > 0 and id(_val) != _before_dfs.get(_cand):
                        _promoted = _val
                        break
                    elif isinstance(_val, pd.Series) and 0 < len(_val) <= 200 and id(_val) != _before_dfs.get(_cand):
                        _preview_df_override = _val.reset_index()
                        break
            if _promoted is None and _preview_df_override is None:
                _best_rows = 0
                for _k, _v in list(globals().items()):
                    if _k.startswith('_') or _k in ('df', 'dfs'):
                        continue
                    if isinstance(_v, pd.DataFrame) and len(_v) > _best_rows and id(_v) != _before_dfs.get(_k):
                        _promoted = _v
                        _best_rows = len(_v)
            if _promoted is not None:
                globals()['df'] = _promoted
        
        # Collect all generated matplotlib figures
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            _polish_figure(fig)
            img_buf = io.BytesIO()
            fig.savefig(img_buf, format='png', bbox_inches='tight', dpi=150)
            img_buf.seek(0)
            encoded = 'data:image/png;base64,' + base64.b64encode(img_buf.read()).decode('ascii')
            output_images.append(encoded)
            plt.close(fig)
            
        # Collect updated DataFrame metadata and preview if present
        _active_table_df = _preview_df_override if isinstance(_preview_df_override, pd.DataFrame) else globals().get('df')
        if isinstance(_active_table_df, pd.DataFrame):
            _target_df = _dedup_df_cols(_active_table_df)
            if _preview_df_override is None:
                globals()['df'] = _target_df
            _df_was_changed = bool(not _df_unchanged or _promoted is not None or _preview_df_override is not None)
            df_info = {
                'shape': list(_target_df.shape),
                'columns': [str(c) for c in _target_df.columns],
                'dfChanged': _df_was_changed
            }
            try:
                # Generate clean preview and CSV
                preview_sub = _target_df.head(100)
                df_preview = {
                    'columns': [str(c) for c in _target_df.columns],
                    'rows': [[_format_cell(val) for val in row] for row in preview_sub.values],
                    'totalRows': int(_target_df.shape[0]),
                    'totalCols': int(_target_df.shape[1])
                }
                df_csv = _target_df.to_csv(index=False)
            except Exception:
                pass
            
    except Exception:
        execution_error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        
    return {
        'stdout': stdout_io.getvalue(),
        'stderr': stderr_io.getvalue(),
        'images': output_images,
        'error': execution_error,
        'dfInfo': df_info,
        'dfPreview': df_preview,
        'dfCsv': df_csv
    }
`
