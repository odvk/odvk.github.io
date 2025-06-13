
let pyodide = null;

const status = document.getElementById("status");
const button = document.getElementById("split-button");
const fileInput = document.getElementById("file-input");
const fileInfo = document.getElementById("file-info");
const progressBar = document.getElementById("progress-bar");
const progressBarContainer = document.getElementById("progress-bar-container");
const zipButton = document.getElementById("download-zip");
const downloadsTable = document.getElementById("downloads-table");
const previewContainer = document.getElementById("preview-container");
const previewCanvas = document.getElementById("preview-canvas");

let currentPdfData = null;
let currentPdfDoc = null;
let previewTask = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    fileInfo.textContent = `Выбран файл: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`;
  } else {
    fileInfo.textContent = "";
  }
});

function updateProgress(percent) {
  progressBarContainer.style.display = "block";
  progressBar.style.width = percent + "%";
}

async function loadPyodideAndPackages() {
  try {
    updateProgress(10);
    pyodide = await loadPyodide();
    updateProgress(40);
    await pyodide.loadPackage("micropip");
    updateProgress(60);
    await pyodide.runPythonAsync(`
      import micropip
      await micropip.install("pypdf")
    `);
    updateProgress(100);
    status.textContent = "✅ Готово! Загрузите PDF для обработки";
    button.disabled = false;
  } catch (err) {
    status.textContent = "❌ Ошибка при загрузке инструментов.";
    console.error(err);
  }
}

loadPyodideAndPackages();

button.onclick = processPDF;

async function processPDF() {
  if (!fileInput.files.length) {
    alert("Пожалуйста, выберите PDF-файл.");
    return;
  }

  const file = fileInput.files[0];
  const arrayBuffer = await file.arrayBuffer();
  currentPdfData = arrayBuffer;
  pyodide.FS.writeFile("input.pdf", new Uint8Array(arrayBuffer));

  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(currentPdfData) });
  currentPdfDoc = await loadingTask.promise;

  status.textContent = "⚙️ Обработка файла...";
  updateProgress(20);

  await pyodide.runPythonAsync(`
    from pypdf import PdfReader, PdfWriter
    import os

    reader = PdfReader("input.pdf")
    os.makedirs("pages", exist_ok=True)
    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        with open(f"pages/page_{i+1}.pdf", "wb") as f:
            writer.write(f)
  `);

  updateProgress(90);
  downloadsTable.innerHTML = "";
  const pageCount = pyodide.runPython("len(reader.pages)");

  zipButton.style.display = "inline-block";
  zipButton.onclick = async () => {
    const zip = new JSZip();
    for (let i = 1; i <= pageCount; i++) {
      const data = pyodide.FS.readFile(`pages/page_${i}.pdf`);
      zip.file(`page_${i}.pdf`, data);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf_pages.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = 7;
  const rows = Math.ceil(pageCount / columns);
  for (let row = 0; row < rows; row++) {
    const tr = document.createElement("tr");
    for (let col = 0; col < columns; col++) {
      const pageNum = row + col * rows + 1;
      const td = document.createElement("td");
      if (pageNum <= pageCount) {
        const data = pyodide.FS.readFile(`pages/page_${pageNum}.pdf`);
        const blob = new Blob([data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const filename = `page_${pageNum}.pdf`;

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.textContent = `📄 Скачать ${filename}`;

        link.addEventListener("mouseenter", e => showPreview(pageNum, e));
        link.addEventListener("mousemove", e => movePreview(e));
        link.addEventListener("mouseleave", hidePreview);

        td.appendChild(link);
      }
      tr.appendChild(td);
    }
    downloadsTable.appendChild(tr);
  }

  updateProgress(100);
  status.textContent = `✅ Готово! Разбито на ${pageCount} страниц.`;
}

function showPreview(pageNumber, event) {
  if (!currentPdfDoc) return;
  if (previewTask) {
    previewTask.cancel();
    previewTask = null;
  }

  currentPdfDoc.getPage(pageNumber).then(page => {
    const viewport = page.getViewport({ scale: 2.0 });
    const context = previewCanvas.getContext("2d");
    previewCanvas.height = viewport.height;
    previewCanvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    previewTask = page.render(renderContext);
    previewTask.promise.then(() => {
      previewContainer.style.display = "block";
      requestAnimationFrame(() => movePreview(event));
    }).catch(() => {});
  });
}

function movePreview(event) {
  const previewWidth = previewContainer.offsetWidth || 388;
  const previewHeight = previewContainer.offsetHeight || 517;
  const padding = 20;

  // ⬅️ Ограничиваем максимальную ширину предпросмотра, чтобы canvas не сжимался
  previewContainer.style.maxWidth = "388px";

  let top;
  if (event.clientY + padding + previewHeight > window.innerHeight) {
    top = event.clientY - previewHeight - padding;
    if (top < 0) top = 0;
  } else {
    top = event.clientY + padding;
  }

  let left = event.clientX + padding;
  if (left + previewWidth > window.innerWidth) {
    left = event.clientX - previewWidth - padding;
    if (left < 0) left = 0;
  }

  previewContainer.style.top = `${top}px`;
  previewContainer.style.left = `${left}px`;
}



function hidePreview() {
  if (previewTask) {
    previewTask.cancel();
    previewTask = null;
  }
  previewContainer.style.display = "none";
}
