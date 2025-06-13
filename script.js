let pyodide = null;

const status = document.getElementById("status");
const button = document.getElementById("split-button");
const fileInput = document.getElementById("file-input");
const fileInfo = document.getElementById("file-info");
const progressBar = document.getElementById("progress-bar");
const progressBarContainer = document.getElementById("progress-bar-container");

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
      await micropip.install("PyPDF2")
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
    from PyPDF2 import PdfReader, PdfWriter
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

  const downloads = document.getElementById("downloads");
  downloads.innerHTML = "";
  const pageCount = pyodide.runPython("len(reader.pages)");

  for (let i = 1; i <= pageCount; i++) {
    const data = pyodide.FS.readFile(`pages/page_${i}.pdf`);
    const blob = new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `page_${i}.pdf`;
    link.textContent = `📥 Скачать page_${i}.pdf`;
    link.style.display = "block";
    downloads.appendChild(link);
  }

  updateProgress(100);
  status.textContent = `✅ Готово! Разбито на ${pageCount} страниц.`;
}
