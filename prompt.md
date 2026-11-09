import warnings
warnings.filterwarnings("ignore")
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# ============================================================
# 1. DATA AUDIT
# ============================================================

print("=" * 62)
print("1. DATA AUDIT")
print("=" * 62)
print(f"Rows: {len(df):,} Columns: {df.shape[1]}")
print(f"Duplicate rows: {df.duplicated().sum()}")
print(f"Total missing cells: {int(df.isna().sum().sum())}")

target = "G3"
df["passed"] = df[target] >= 10  # 10 = pass threshold on the 0-20 scale
df["at_risk"] = df[target] < 10
df["grade_drop"] = df["G2"] - df["G3"]
df["avg_parent_edu"] = (df["Mother_edu"] + df["Father_edu"]) / 2

print(f"\nG3 range: {df[target].min()}-{df[target].max()} mean {df[target].mean():.2f} median {df[target].median():.0f}")
print(f"G3 = 0 (likely withdrew) : {(df[target] == 0).sum()} ({(df[target] == 0).mean()*100:.1f}%)")
print(f"Pass rate (G3 >= 10)     : {df.passed.mean()*100:.1f}% ({df.passed.sum()}/{len(df)})")
print(f"G1 -> G3 mean drop       : {(df['G1'] - df['G3']).mean():.2f} points")
print(f"G2 -> G3 mean drop       : {df.grade_drop.mean():.2f} points")

print("\nCategorical sanity check (distinct values):")
cat_cols = df.select_dtypes(include=["object", "bool"]).columns
for c in cat_cols:
    print(f"  {c:28s} {df[c].nunique():>2} -> {list(df[c].unique())[:6]}")

# ============================================================
# 2. NUMERIC DESCRIPTIVES
# ============================================================

print("\n" + "=" * 62)
print("2. NUMERIC DESCRIPTIVES")
print("=" * 62)
num_cols = df.select_dtypes(include="number").columns.drop(["passed", "at_risk"], errors="ignore")
desc = df[num_cols].describe().T[["mean", "std", "min", "25%", "50%", "75%", "max"]]
print(desc.round(2).to_string())

# ============================================================
# 3. HOW FEATURES RELATE TO THE FINAL GRADE
# ============================================================

print("\n" + "=" * 62)
print("3. CORRELATION WITH G3 (numeric features)")
print("=" * 62)
corr_g3 = (df[num_cols].corr()[target]
           .drop([target, "G1", "G2"], errors="ignore")
           .sort_values())
print(corr_g3.round(3).to_string())
print(f"\nG2 vs G3 r = {df[['G2','G3']].corr().iloc[0,1]:.3f} (prior grade is by far the strongest signal)")

def group_effect(col, by="passed"):
    """Mean G3 and pass rate per category."""
    out = (df.groupby(col)
           .agg(n=("G3", "size"), mean_G3=("G3", "mean"), pass_rate=("passed", "mean"))
           .sort_values("mean_G3", ascending=False))
    out["pass_rate"] = (out["pass_rate"] * 100).round(1)
    out["mean_G3"] = out["mean_G3"].round(2)
    return out

print("\n" + "=" * 62)
print("4. GROUP COMPARISONS (mean G3, pass rate %)")
print("=" * 62)
for col in ["sex", "school", "address", "famsize", "Parrent_status",
            "extra_paid_class", "extra_edu_supp", "family_edu_supp",
            "internet_access", "romantic_relationship",
            "Interested_in_higher_edu", "extra_curr_activities"]:
    if col in df.columns:
        print(f"\n--- {col} ---")
        print(group_effect(col).to_string())

# ============================================================
# 5. ORDINAL / BINNED FEATURES
# ============================================================

print("\n" + "=" * 62)
print("5. ORDINAL FEATURES")
print("=" * 62)
ordinal_cols = ["failures", "weekly_studytime", "traveltime", "goout_with_friends",
                "freetime_after_school", "workday_alcohol_consum", "weekend_alcohol_consum",
                "health_status", "Family_quality_reln", "Mother_edu", "Father_edu", "age"]
for col in ordinal_cols:
    if col in df.columns:
        g = df.groupby(col).agg(n=("G3", "size"), mean_G3=("G3", "mean"))
        g["mean_G3"] = g["mean_G3"].round(2)
        spread = g.mean_G3.max() - g.mean_G3.min()
        print(f"{col:24s} spread {spread:5.2f} pts | " +
              " ".join(f"{k}:{v:.1f}" for k, v in g.mean_G3.items()))

if "absences" in df.columns:
    df["absence_band"] = pd.cut(df.absences, [-1, 0, 4, 10, 100],
                                labels=["0", "1-4", "5-10", "11+"])
    print("\n--- absences band ---")
    print(df.groupby("absence_band", observed=True)
          .agg(n=("G3", "size"), mean_G3=("G3", "mean"), pass_rate=("passed", "mean"))
          .round(2).to_string())

# ============================================================
# 6. COMBINED RISK SEGMENTATION
# ============================================================

print("\n" + "=" * 62)
print("6. RISK SEGMENTATION (failures x study time)")
print("=" * 62)
if "failures" in df.columns and "weekly_studytime" in df.columns:
    risk = (df.groupby(["failures", "weekly_studytime"])
            .agg(n=("G3", "size"), mean_G3=("G3", "mean"), pass_rate=("passed", "mean"))
            .round(2))
    print(risk.to_string())

    df["risk_segment"] = np.select(
        [df.failures >= 2,
         (df.failures == 1) & (df.weekly_studytime <= 2),
         (df.failures == 0) & (df.weekly_studytime >= 3)],
        ["High risk", "Watch", "Strong"], default="Average")

    print("\n--- composite segment ---")
    print(df.groupby("risk_segment")
          .agg(n=("G3", "size"), share=("G3", lambda s: len(s) / len(df) * 100),
               mean_G3=("G3", "mean"), pass_rate=("passed", lambda s: s.mean() * 100))
          .round(2).sort_values("mean_G3", ascending=False).to_string())

# ============================================================
# 7. SIMPLE LINEAR DRIVER MODEL
# ============================================================

from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

features = [c for c in ["G2", "failures", "weekly_studytime", "absences", "goout_with_friends",
                        "Mother_edu", "Father_edu", "age", "health_status", "Family_quality_reln",
                        "weekend_alcohol_consum", "traveltime"] if c in df.columns]
if len(features) > 0 and target in df.columns:
    X = pd.get_dummies(df[features], drop_first=True)
    y = df[target]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42)
    model = LinearRegression().fit(X_tr, y_tr)
    pred = model.predict(X_te)

    print("\n" + "=" * 62)
    print("7. LINEAR MODEL (predicting G3, 75/25 split)")
    print("=" * 62)
    print(f"Train R2 {model.score(X_tr, y_tr):.3f} | Test R2 {r2_score(y_te, pred):.3f} | "
          f"MAE {mean_absolute_error(y_te, pred):.2f} points")

    if "G2" in X.columns:
        X_no = X.drop(columns=["G2"])
        Xn_tr, Xn_te, y_n_tr, y_n_te = train_test_split(X_no, y, test_size=0.25, random_state=42)
        m2 = LinearRegression().fit(Xn_tr, y_n_tr)
        print(f"Without G2 (background only): Test R2 {r2_score(y_n_te, m2.predict(Xn_te)):.3f} "
              f"| MAE {mean_absolute_error(y_n_te, m2.predict(Xn_te)):.2f}")

    coefs = (pd.Series(model.coef_, index=X.columns)
             .sort_values(key=abs, ascending=False).head(10))
    print("\nTop standardized drivers (points of G3 per unit):")
    print(coefs.round(3).to_string())

# ============================================================
# 8. VISUALISATIONS
# ============================================================

fig, axes = plt.subplots(2, 3, figsize=(17, 9))

# (a) G3 distribution
if target in df.columns:
    axes[0, 0].hist(df[target], bins=21, color="#2563eb", edgecolor="white")
    axes[0, 0].axvline(10, color="#dc2626", ls="--", lw=2, label="Pass = 10")
    axes[0, 0].set(title="Final grade distribution (G3)", xlabel="G3 (0-20)", ylabel="Students")
    axes[0, 0].legend()

# (b) G2 vs G3
if "G2" in df.columns and "G3" in df.columns:
    axes[0, 1].scatter(df.G2, df.G3, s=14, alpha=0.55, color="#8b5cf6")
    axes[0, 1].plot([0, 20], [0, 20], color="#6b7280", ls=":", lw=1)
    axes[0, 1].set(title="Prior grade G2 predicts G3", xlabel="G2", ylabel="G3")

# (c) failures vs mean G3
if "failures" in df.columns and "G3" in df.columns:
    g = df.groupby("failures").G3.agg(["mean", "size"])
    axes[0, 2].bar(g.index.astype(str), g["mean"],
                   color=["#16a34a", "#f59e0b", "#f97316", "#dc2626"][:len(g)], edgecolor="white")
    for i, (m, n) in enumerate(zip(g["mean"], g["size"])):
        axes[0, 2].text(i, m + 0.25, f"{m:.1f}\n(n={n})", ha="center", fontsize=8)
    axes[0, 2].set(title="Each past failure costs grade points",
                   xlabel="Past class failures", ylabel="Mean G3")

# (d) study time
if "weekly_studytime" in df.columns and "G3" in df.columns:
    g = df.groupby("weekly_studytime").G3.mean()
    axes[1, 0].bar(g.index.astype(str), g.values, color="#2563eb", edgecolor="white")
    axes[1, 0].set(title="Weekly study time (1 = <2h, 4 = >10h)",
                   xlabel="Study time band", ylabel="Mean G3")

# (e) go out with friends
if "goout_with_friends" in df.columns and "G3" in df.columns:
    g = df.groupby("goout_with_friends").G3.mean()
    axes[1, 1].bar(g.index.astype(str), g.values, color="#8b5cf6", edgecolor="white")
    axes[1, 1].set(title="Socialising frequency vs mean G3",
                   xlabel="Go out with friends (1 = very low, 5 = very high)", ylabel="Mean G3")

# (f) sex x alcohol
if "sex" in df.columns and "weekend_alcohol_consum" in df.columns and "G3" in df.columns:
    pivot = df.pivot_table(index="sex", columns="weekend_alcohol_consum", values="G3", aggfunc="mean")
    pivot.T.plot(ax=axes[1, 2], marker="o")
    axes[1, 2].set(title="Weekend alcohol vs mean G3, by sex",
                   xlabel="Weekend alcohol (1 = very low, 5 = very high)", ylabel="Mean G3")
    axes[1, 2].legend(title="sex")

plt.tight_layout()

# ============================================================
# 9. KEY TAKEAWAYS
# ============================================================

print("\n" + "=" * 62)
print("9. KEY TAKEAWAYS")
print("=" * 62)
if "risk_segment" in df.columns:
    strong = df.risk_segment.eq("Strong")
    high = df.risk_segment.eq("High risk")
    print(f"- Mean final grade {df.G3.mean():.1f}/20; {df.passed.mean()*100:.1f}% pass, "
          f"{df[target].eq(0).sum()} students scored 0 (probable dropout).")
    if "failures" in df.columns:
        print(f"- Past failures is the strongest background predictor.")
    print(f"- Strong segment: {strong.sum()} students ({strong.mean()*100:.0f}%), "
          f"pass rate {df[strong].passed.mean()*100:.0f}%.")
    print(f"- High-risk segment: {high.sum()} students ({high.mean()*100:.0f}%), "
          f"pass rate {df[high].passed.mean()*100:.0f}%.")
