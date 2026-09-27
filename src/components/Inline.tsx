/**
 * Inline Markdown (code, strong, emphasis) of a content text as Preact elements. The text is never
 * parsed as HTML. Used by the islands that paint content strings.
 */
import { trozosInline } from '../lib/inline';

export default function Inline({ texto }: { texto: string | undefined }) {
  return (
    <>
      {trozosInline(texto ?? '').map((trozo) => {
        if (trozo.tipo === 'codigo') return <code>{trozo.texto}</code>;
        if (trozo.tipo === 'fuerte') return <strong>{trozo.texto}</strong>;
        if (trozo.tipo === 'enfasis') return <em>{trozo.texto}</em>;
        return trozo.texto;
      })}
    </>
  );
}
