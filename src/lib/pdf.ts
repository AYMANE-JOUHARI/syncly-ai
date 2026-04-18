// Client-side PDF text extraction using pdfjs-dist.
// We disable the worker so we don't depend on a CDN/worker URL that
// frequently fails to load (CORS, version mismatch, offline). This is
// slower per page but is the most reliable path in a browser.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Best-effort: provide a worker URL, but also disable the worker so
  // pdfjs runs the parser on the main thread if the worker fetch fails.
  try {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  } catch {
    /* ignore */
  }

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: buf,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  let out = "";
  const max = Math.min(doc.numPages, 30);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return out.slice(0, 60000);
}
