export interface PDFPageViewport {
  width: number;
  height: number;
}

export interface RenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFPageViewport;
  render(params: {
    canvas?: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
  }): RenderTask;
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  cleanup(keepLoadedFonts?: boolean): Promise<unknown>;
}

export interface PDFDocumentLoadingTask {
  promise: Promise<PDFDocumentProxy>;
  destroy(): Promise<void>;
}

export declare const GlobalWorkerOptions: {
  workerSrc: string;
};

export declare function getDocument(src: {
  url: string;
  rangeChunkSize?: number;
  disableAutoFetch?: boolean;
  disableStream?: boolean;
}): PDFDocumentLoadingTask;
