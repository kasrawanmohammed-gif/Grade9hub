import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Matches scientific quantities with SI units, parenthesized unit symbols,
 * and ASCII physics equations/formulas so they render cleanly in RTL (Kurdish/Arabic)
 * without BiDi scrambling of minus signs, slashes, or parentheses.
 */
const SCI_QTY =
  '[+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*(?:°\\s*[CFK]|m\\/s²|m\\/s\\^2|m\\/s|km\\/h|N·m|J\\/\\(kg·°[CF]\\)|J\\/kg·°[CF]|J\\/s|N\\/m²|kg|mg|km|cm|mm|Hz|Pa|kJ|kW|kPa|m|g|s|N|J|W|K|A|V|Ω)(?![A-Za-z0-9_])';

const PAREN_UNIT =
  '\\(\\s*(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*)?(?:°[CFK]|m\\/s²|m\\/s|km\\/h|N·m|J\\/\\(kg·°[CF]\\)|J\\/kg·°[CF]|kg|mg|km|cm|mm|Hz|Pa|kJ|kW|kPa|N|J|W|K|m|g|s)\\s*\\)';

const ASCII_EQUATION =
  '(?:Δ?[A-Za-z][A-Za-z0-9_]*)\\s*=\\s*(?:\\([^()]*\\)|[A-Za-z0-9_,+−\\-*/^²³·×÷Δ°%≈]|\\.(?=\\d)|\\s(?=[A-Za-z0-9_Δ(+\\-−°]))+(?:\\s*(?:°\\s*[CFK]|m\\/s²|m\\/s|km\\/h|N·m|J\\/\\(kg·°[CF]\\)|J\\/kg·°[CF]|kg|cm|mm|km|Hz|Pa|N|J|W|K|m|g|s))?';

const SCIENTIFIC_SEGMENT_RE = new RegExp(
  `(${PAREN_UNIT}|${ASCII_EQUATION}|${SCI_QTY})`,
  'g'
);

export function splitScientificSegments(text: string): Array<{ text: string; isolate: boolean }> {
  if (!text) return [];
  const parts: Array<{ text: string; isolate: boolean }> = [];
  let lastIndex = 0;
  SCIENTIFIC_SEGMENT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SCIENTIFIC_SEGMENT_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isolate: false });
    }
    const token = match[0].trimEnd();
    const trailingSpaces = match[0].length - token.length;
    parts.push({ text: token, isolate: true });
    if (trailingSpaces > 0) {
      parts.push({
        text: match[0].slice(token.length),
        isolate: false,
      });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isolate: false });
  }

  return parts;
}

interface ScientificTextProps {
  text: string;
}

export const ScientificText: React.FC<ScientificTextProps> = ({ text }) => {
  const { dir } = useLanguage();

  if (!text || dir !== 'rtl') {
    return <>{text}</>;
  }

  const segments = splitScientificSegments(text);
  if (segments.length <= 1 && !segments[0]?.isolate) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, idx) =>
        seg.isolate ? (
          <bdi key={idx} dir="ltr">
            {seg.text}
          </bdi>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};
