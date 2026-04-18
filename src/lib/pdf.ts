// @ts-ignore — Vite resolves this to a local URL at build time
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: buf,
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
