let pyodide = null;

async function loadPyodideAndPackages() {
  const status = document.getElementById("status");
  const button = document.getElementById("split-button");

  try {
    pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync(`
      import micropip
      await micropip.install("PyPDF2")
    `);

    status.textContent = "✅ Готово! Загрузите PDF для обработки";
    button.disabled = false;
  } catch (err) {
    status.textContent = "❌ Ошибка при загрузке инструментов.";
    console.error(err);
  }
}

loadPyodideAndPackages();

async function processPDF() {
  const input = document.getElementById("file-input");
  const status = document.getElementById("status");

  if (!input.files.length) {
    alert("Пожалуйста, выберите PDF-файл.");
    return;
  }

  const file = input.files[0];
  const arrayBuffer = await file.arrayBuffer();
  pyodide.FS.writeFile("input.pdf", new Uint8Array(arrayBuffer));

  status.textContent = "⚙️ Обработка файла...";

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

  status.textContent = `✅ Готово! ${pageCount} страниц доступны для скачивания.`;
}
