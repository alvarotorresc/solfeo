/**
 * Progress dots above a card: right, wrong, current or pending. Decorative for screen readers.
 * Without `actual` no dot is marked as the current one.
 */
import '../styles/pasos.css';

interface Props {
  marcas: readonly (boolean | null)[];
  actual?: number;
  terminado?: boolean;
}

export default function Pasos({ marcas, actual, terminado = false }: Props) {
  return (
    <ol class="steps" aria-hidden="true">
      {marcas.map((marca, i) => (
        <li
          class={
            marca === true
              ? 'ok'
              : marca === false
                ? 'bad'
                : i === actual && !terminado
                  ? 'now'
                  : ''
          }
        />
      ))}
    </ol>
  );
}
