// script.js
let pyodide = null;

const status = document.getElementById("status");
const button = document.getElementById("split-button");
const fileInput = document.getElementById("file-input");
const fileInfo = document.getElementById("file-info");
const progressBar = document.getElementById("progress-bar");
const progressBarContainer = document.getElementById("progress-bar-container");
const zipButton = document.getElementById("download-zip");
const downloadsTable = document.getElementById("downloads-table");

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

async function processPDF() {
  if (!fileInput.files.length) {
    alert("Пожалуйста, выберите PDF-файл.");
    return;
  }

  const file = fileInput.files[0];
  const arrayBuffer = await file.arrayBuffer();
  pyodide.FS.writeFile("input.pdf", new Uint8Array(arrayBuffer));

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

  // Подготовка ZIP-файла
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

  // Генерация таблицы ссылок
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

        const link = document.createElement("a");
        link.href = url;
        link.download = `page_${pageNum}.pdf`;
        link.textContent = `📄 Скачать page_${pageNum}.pdf`;
        td.appendChild(link);
      }
      tr.appendChild(td);
    }
    downloadsTable.appendChild(tr);
  }

  updateProgress(100);
  status.textContent = `✅ Готово! Разбито на ${pageCount} страниц.`;
}
