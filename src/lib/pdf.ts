// Client-side PDF text extraction using pdfjs-dist
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Use a CDN worker to avoid bundling complexity
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  const max = Math.min(doc.numPages, 30);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => it.str).join(" ") + "\n\n";
  }
  return out.slice(0, 60000);
}
