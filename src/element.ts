// <ax-acrylic>, built on the surface engine: the acrylic layer clipped to the surface shape.
// Markup and the --acrylic-* properties are unchanged; the --ax-* shape properties now shape it.
import { AxSurface } from '@ax-design/surface';

export class AxAcrylic extends AxSurface {
    static readonly ElementName = 'ax-acrylic';
    static schemaKey = 'ax-acrylic';

    protected layerNames_(): string[] {
        return ['acrylic'];
    }
}
