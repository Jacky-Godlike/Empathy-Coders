"""Aggregate risk-type exposure and produce a short improvement brief.

The pie chart answers "which risk types dominate the order book?". The brief
answers "what internal process should the business improve first?".

The AI provider is only used to write the brief. The aggregation, ranking and
rule-based fallback are deterministic and always available, so the feature
still works without a key.
"""

from __future__ import annotations

import json
import re
from statistics import mean
from typing import Any

from . import ai_client, config

FACTOR_KEYS = ("stock", "delivery", "margin", "data", "anomaly")

FACTOR_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "stock": "Stock / capacity",
        "delivery": "Delivery feasibility",
        "margin": "Margin",
        "data": "Data completeness",
        "anomaly": "Order anomaly",
    },
    "zh": {
        "stock": "库存 / 产能",
        "delivery": "交期可行性",
        "margin": "利润",
        "data": "数据完整性",
        "anomaly": "订单异常",
    },
    "ms": {
        "stock": "Stok / kapasiti",
        "delivery": "Kemungkinan penghantaran",
        "margin": "Margin",
        "data": "Kelengkapan data",
        "anomaly": "Anomali pesanan",
    },
}

SUGGESTIONS: dict[str, dict[str, str]] = {
    "en": {
        "stock": "Review safety stock and reorder points for the SKUs causing the shortfall.",
        "delivery": "Build supplier lead time plus a buffer into promised delivery dates.",
        "margin": "Review cost prices or set a minimum-margin rule for low-margin products.",
        "data": "Add required-field checks at intake and confirm missing details before quoting.",
        "anomaly": "Review high-value, duplicate and unusual orders before approval.",
    },
    "zh": {
        "stock": "检查缺口最大的 SKU 的安全库存和补货点。",
        "delivery": "在承诺交期时预留供应商交期和缓冲时间。",
        "margin": "复核成本价，并为低毛利产品设置最低毛利规则。",
        "data": "在接单时增加必填字段校验，报价前补齐缺失信息。",
        "anomaly": "审批前重点复核高金额、重复和异常订单。",
    },
    "ms": {
        "stock": "Semak stok keselamatan dan titik pesanan semula bagi SKU yang kekurangan.",
        "delivery": "Masukkan masa petunjuk pembekal dan buffer dalam tarikh penghantaran yang dijanjikan.",
        "margin": "Semak harga kos atau tetapkan peraturan margin minimum untuk produk margin rendah.",
        "data": "Tambah semakan medan wajib semasa ambil pesanan dan lengkapkan maklumat sebelum sebut harga.",
        "anomaly": "Semak pesanan bernilai tinggi, pendua dan luar biasa sebelum kelulusan.",
    },
}

SUMMARY_TEMPLATE = {
    "en": "The largest risk contributors are {first} ({first_pct}) and {second} ({second_pct}). These are mostly internal operating issues, so process changes can reduce them.",
    "zh": "当前最大的两类风险是{first}（{first_pct}）和{second}（{second_pct}）。这些问题主要来自内部运营流程，可以通过流程调整来改善。",
    "ms": "Penyumbang risiko terbesar ialah {first} ({first_pct}) dan {second} ({second_pct}). Ini banyak berpunca daripada proses dalaman dan boleh dikurangkan melalui penambahbaikan proses.",
}

ONE_RISK_TEMPLATE = {
    "en": "The largest risk contributor is {first} ({first_pct}). This is mostly an internal operating issue, so process changes can reduce it.",
    "zh": "当前最大的风险是{first}（{first_pct}）。这主要来自内部运营流程，可以通过流程调整来改善。",
    "ms": "Penyumbang risiko terbesar ialah {first} ({first_pct}). Ini banyak berpunca daripada proses dalaman dan boleh dikurangkan melalui penambahbaikan proses.",
}

LANGUAGE_NAME = {
    "en": "English",
    "zh": "Simplified Chinese",
    "ms": "Bahasa Melayu",
}


def _pct(value: float) -> str:
    return f"{round(value * 100)}%"


def aggregate_risk_types(orders: list[dict]) -> tuple[list[dict], float]:
    """Return sorted risk-type shares and the total weighted risk points."""

    totals: dict[str, dict[str, Any]] = {
        key: {"points": 0.0, "scores": [], "affected": 0, "examples": []}
        for key in FACTOR_KEYS
    }

    for order in orders:
        analysis = order.get("analysis") or {}
        for factor in analysis.get("riskFactors") or []:
            key = factor.get("key")
            if key not in totals:
                continue
            score = float(factor.get("score") or 0)
            weighted = float(factor.get("weighted") or 0)
            totals[key]["points"] += weighted
            totals[key]["scores"].append(score)
            if score >= 50:
                totals[key]["affected"] += 1
                detail = str(factor.get("detail") or "").strip()
                if detail:
                    totals[key]["examples"].append(detail)

    total_points = sum(data["points"] for data in totals.values())
    items: list[dict] = []
    for key, data in totals.items():
        if data["points"] <= 0:
            continue
        items.append(
            {
                "key": key,
                "label": FACTOR_LABELS["en"][key],
                "share": round(
                    data["points"] / total_points if total_points else 0, 4
                ),
                "points": round(data["points"], 1),
                "averageScore": round(mean(data["scores"]), 1)
                if data["scores"]
                else 0,
                "affectedOrders": data["affected"],
                "examples": data["examples"][:3],
            }
        )

    items.sort(key=lambda item: item["points"], reverse=True)
    return items, round(total_points, 1)


def _localise(items: list[dict], language: str) -> list[dict]:
    labels = FACTOR_LABELS.get(language, FACTOR_LABELS["en"])
    return [{**item, "label": labels[item["key"]]} for item in items]


def _fallback_brief(top: list[dict], language: str) -> tuple[str, list[str]]:
    language = language if language in SUMMARY_TEMPLATE else "en"
    if not top:
        if language == "zh":
            return "还没有可分析的订单。先运行订单识别，才能生成风险建议。", []
        if language == "ms":
            return "Belum ada pesanan yang dianalisis. Jalankan pengambilan pesanan untuk membina cadangan risiko.", []
        return "No analysed orders yet. Run intake to build a risk profile.", []

    first = top[0]
    if len(top) == 1:
        summary = ONE_RISK_TEMPLATE[language].format(
            first=first["label"], first_pct=_pct(first["share"])
        )
    else:
        second = top[1]
        summary = SUMMARY_TEMPLATE[language].format(
            first=first["label"],
            first_pct=_pct(first["share"]),
            second=second["label"],
            second_pct=_pct(second["share"]),
        )

    suggestions = [
        SUGGESTIONS[language].get(item["key"], SUGGESTIONS["en"][item["key"]])
        for item in top[:2]
    ]
    return summary, suggestions


def _prompt(top: list[dict], order_count: int, industry: str, language: str) -> str:
    rows = []
    for index, item in enumerate(top[:2], start=1):
        rows.append(
            f"{index}. {FACTOR_LABELS['en'][item['key']]} — "
            f"{_pct(item['share'])} of weighted risk points; "
            f"average score {item['averageScore']}/100; "
            f"{item['affectedOrders']} order(s) above 50."
        )
        for example in item["examples"][:2]:
            rows.append(f"   Example: {example}")

    return f"""You advise a Malaysian SME owner on operational improvements.
Analyse the two largest risk types from their order desk.

Industry: {industry}
Orders analysed: {order_count}
Top risk types:
{chr(10).join(rows)}

Write in {LANGUAGE_NAME.get(language, 'English')}.
Return JSON only, with this shape:
{{"summary": "2 short sentences, max 45 words", "suggestions": ["max 18 words", "max 18 words"]}}

Focus on internal process improvements (stock, supplier lead time, pricing, data collection, order checks).
Do not blame customers. Do not approve orders. Do not mention that you are an AI."""


def _parse_ai_brief(raw: str) -> tuple[str, list[str]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    data = json.loads(text)
    summary = str(data.get("summary") or "").strip()
    suggestions = [
        str(item).strip()
        for item in (data.get("suggestions") or [])
        if str(item).strip()
    ][:3]
    if not summary or not suggestions:
        raise ValueError("The AI response did not include a summary and suggestions.")
    return summary[:320], [item[:180] for item in suggestions]


def generate_risk_insights(
    orders: list[dict],
    language: str = "en",
    industry: str = "fnb",
) -> dict[str, Any]:
    language = language if language in FACTOR_LABELS else "en"
    items, total_points = aggregate_risk_types(orders)
    top = items[:2]
    localised = _localise(items, language)
    localised_top = _localise(top, language)

    summary, suggestions = _fallback_brief(localised_top, language)
    generated_by = "rules"
    provider_label = "Rules engine"
    model = "rules-only"
    ai_error = None

    if ai_client.configured() and top:
        try:
            raw = ai_client.generate_json(
                _prompt(top, len(orders), industry, language)
            )
            summary, suggestions = _parse_ai_brief(raw)
            generated_by = "ai"
            provider_label = ai_client.provider_label()
            model = config.AI_MODEL
        except Exception as exc:  # noqa: BLE001 - fallback is the point
            ai_error = str(exc)[:240]

    return {
        "orderCount": len(orders),
        "totalRiskPoints": total_points,
        "topRisks": localised_top,
        "allRisks": localised,
        "summary": summary,
        "suggestions": suggestions,
        "generatedBy": generated_by,
        "providerLabel": provider_label,
        "model": model,
        "language": language,
        "aiConfigured": ai_client.configured(),
        "aiError": ai_error,
    }
