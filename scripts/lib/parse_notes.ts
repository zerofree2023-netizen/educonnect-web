// scripts/lib/parse_notes.ts
export type NotesParseResult = {
  extracted: Record<string, any>;
  checklist: Record<string, boolean>;
  raw: string;
};

function numFrom(s: string | null | undefined) {
  if (!s) return null;
  const t = String(s).replace(/,/g, "");
  const m = t.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

export function parseNotes(notesRaw: string): NotesParseResult {
  const raw = notesRaw || "";
  const notes = raw.replace(/\s+/g, " ").trim();

  const extracted: any = {};
  const checklist: any = {};

  // 学制：学制6年 / 6 年 / duration 4 year
  {
    const m =
      notes.match(/学制\s*[:：]?\s*([0-9]{1,2})\s*年/) ||
      notes.match(/\b([0-9]{1,2})\s*年\b/) ||
      notes.match(/duration\s*[:：]?\s*([0-9]{1,2})\s*(?:year|years)?/i);
    if (m) {
      extracted.duration_years = Number(m[1]);
      checklist.has_duration = true;
    } else {
      checklist.has_duration = false;
    }
  }

  // 学费（RMB/年）
  {
    const m =
      notes.match(/学费.*?(?:人民币|RMB)\s*[,:：]?\s*([0-9,]+(?:\.[0-9]+)?)/i) ||
      notes.match(/([0-9,]+)\s*元\s*(?:\/\s*学年|\/\s*年|每年)/) ||
      notes.match(/([0-9,]+)\s*\/\s*学年/);
    if (m) {
      extracted.tuition_rmb_per_year = numFrom(m[1]);
      checklist.has_tuition = true;
    } else {
      checklist.has_tuition = false;
    }
  }

  // 截止日期 YYYY-MM-DD / 2026/05/31 / 2026.05.31
  {
    const md = notes.match(/\b(20[2-9][0-9])[-\/年\.]([01]?\d)[-\/月\.]([0-3]?\d)\b/);
    if (md) {
      const y = md[1];
      const mm = String(md[2]).padStart(2, "0");
      const d = String(md[3]).padStart(2, "0");
      extracted.deadline = `${y}-${mm}-${d}`;
      checklist.has_deadline = true;
    } else {
      checklist.has_deadline = false;
    }
  }

  // 教学地点 / 校区
  {
    const m =
      notes.match(/教学地点[:：\s]*([^;，.,]+?)(?:;|，|,|。|$)/) ||
      notes.match(/校区[:：\s]*([^;，.,]+?)(?:;|，|,|。|$)/) ||
      notes.match(/campus[:：\s]*([^;，.,]+?)(?:;|，|,|。|$)/i);
    if (m) {
      extracted.campus = m[1].trim();
      checklist.has_campus = true;
    } else {
      checklist.has_campus = false;
    }
  }

  // IELTS / TOEFL / Duolingo
  {
    const i_total =
      notes.match(/IELTS[^0-9]*([0-9](?:\.[05])?)/i) ||
      notes.match(/雅思[^0-9]*([0-9](?:\.[05])?)/);
    const i_min =
      notes.match(/(?:单项|each band|per subscore)[^\d]*([0-9](?:\.[05])?)/i);

    extracted.ielts_total = i_total ? Number(i_total[1]) : null;
    extracted.ielts_min = i_min ? Number(i_min[1]) : null;

    const t_total = notes.match(/TOEFL\s*(?:iBT)?[^\d]*([0-9]{2,3})/i);
    const t_min = notes.match(/TOEFL.*?(?:单项|each)[^\d]*([0-9]{1,2})/i);

    extracted.toefl_total = t_total ? Number(t_total[1]) : null;
    extracted.toefl_min = t_min ? Number(t_min[1]) : null;

    const d = notes.match(/Duolingo[^0-9]*([0-9]{2,3})/i);
    extracted.duolingo = d ? Number(d[1]) : null;

    checklist.has_language = !!(extracted.ielts_total || extracted.toefl_total || extracted.duolingo);
    checklist.has_ielts = !!extracted.ielts_total;
    checklist.has_toefl = !!extracted.toefl_total;
    checklist.has_duolingo = !!extracted.duolingo;
  }

  checklist.contains_scholarship = /奖学金|scholarship/i.test(notes);
  checklist.contains_fee_info = /学费|RMB|Tuition|fee/i.test(notes);

  return { extracted, checklist, raw };
}