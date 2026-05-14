const TITLE_PATTERNS = [
  /^EXMO(?:S?)\.\s*(?:SR\.|SR[A]\.)\s*DR(?:A?)\./i,
  /^EXCELENT[IÍ]SSIMO/i,
  /^DOS? FATOS?$/i,
  /^DO DIREITO$/i,
  /^DA JURISPRUD[EÊ]NCIA$/i,
  /^DOS? PEDIDOS?$/i,
  /^DO VALOR DA CAUSA$/i,
  /^DA COMPET[EÊ]NCIA$/i,
  /^DA LEGITIMIDADE$/i,
  /^DA FUNDAMENTA[CÇ][AÃ]O JUR[IÍ]DICA$/i,
  /^CONCLUS[AÃ]O$/i,
  /^REQUER(?:IMENTO)?S?$/i,
  /^PEDIDO[S]?$/i,
  /^NESTES TERMOS/i,
  /^TERMOS EM QUE/i,
];

const CENTER_PATTERNS = [
  /^EXMO(?:S?)\.\s*(?:SR\.|SR[A]\.)/i,
  /^EXCELENT[IÍ]SSIMO/i,
  /^ILLM[OA]\./i,
];

const CITATION_START_PATTERNS = [
  /^[""]|^«|^\(/,
  /^EMENTA:/i,
  /^RELAT[OÓ]RIO:/i,
];

const CLOSING_PATTERNS = [
  /^Nestes termos/i,
  /^Termos em que/i,
  /^Pede deferimento/i,
  /^Aguarda-se/i,
  /^Respeitosamente/i,
  /^Atenciosamente/i,
];

export type LineType = "title-center" | "title-justify" | "citation" | "closing" | "paragraph" | "empty";

export interface FormattedLine {
  type: LineType;
  text: string;
}

export function formatLegalText(text: string): FormattedLine[] {
  if (!text || !text.trim()) return [{ type: "empty", text: "" }];

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const result: FormattedLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      result.push({ type: "empty", text: "" });
      continue;
    }

    const isAllCaps = line === line.toUpperCase() && line.length > 2 && line.length < 120 && /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/.test(line);
    const isTitle = TITLE_PATTERNS.some((p) => p.test(line));
    const isCentered = CENTER_PATTERNS.some((p) => p.test(line));
    const isCitation = CITATION_START_PATTERNS.some((p) => p.test(line));
    const isClosing = CLOSING_PATTERNS.some((p) => p.test(line));

    if (isClosing) {
      result.push({ type: "closing", text: line });
    } else if (isTitle || (isAllCaps && !isCitation)) {
      if (isCentered) {
        result.push({ type: "title-center", text: line });
      } else {
        result.push({ type: "title-justify", text: line });
      }
    } else if (isCitation) {
      result.push({ type: "citation", text: line });
    } else {
      result.push({ type: "paragraph", text: line });
    }
  }

  return result;
}

export function plainTextToLegalHtml(text: string): string {
  if (!text || !text.trim()) return "<p></p>";

  const lines = formatLegalText(text);
  const parts: string[] = [];

  for (const line of lines) {
    if (line.type === "empty") {
      if (parts.length > 0) parts.push('<p style="margin:0;line-height:0.5;">&nbsp;</p>');
      continue;
    }

    const esc = line.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (line.type === "title-center") {
      parts.push(`<p style="text-align:center;font-weight:bold;text-transform:uppercase;text-indent:0;margin:0.4cm 0 0.2cm;line-height:1.5;">${esc}</p>`);
    } else if (line.type === "title-justify") {
      parts.push(`<p style="text-align:justify;font-weight:bold;text-transform:uppercase;text-indent:0;margin:0.4cm 0 0.2cm;line-height:1.5;">${esc}</p>`);
    } else if (line.type === "citation") {
      parts.push(`<p style="margin-left:4cm;margin-right:4cm;font-size:10pt;line-height:1.2;text-align:justify;font-style:italic;text-indent:0;">${esc}</p>`);
    } else if (line.type === "closing") {
      parts.push(`<p style="text-align:justify;text-indent:0;margin:0.4cm 0 0.2cm;line-height:1.5;">${esc}</p>`);
    } else {
      parts.push(`<p style="text-align:justify;text-indent:4cm;margin:0 0 0.2cm;line-height:1.5;">${esc}</p>`);
    }
  }

  return parts.join("\n") || "<p></p>";
}
