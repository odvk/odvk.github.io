let pyodide = null;

async function loadPyodideAndPackages() {
  document.getElementById("status").textContent = "🔄 Загружается Pyodide...";
  pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install("PyPDF2")
  `);
  document.getElementById("status").textContent = "✅ Pyodide загружен.";
}

loadPyodideAndPackages();

async function processPDF() {
  const input = document.getElementById("file-input");
  if (!input.files.length) {
    alert("Выберите PDF-файл!");
    return;
  }

  const file = input.files[0];
  const arrayBuffer = await file.arrayBuffer();

  pyodide.FS.writeFile("input.pdf", new Uint8Array(arrayBuffer));
  document.getElementById("status").textContent = "⚙️ Обрабатываем PDF...";

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

  // Отображение ссылок на страницы
  const downloads = document.getElementById("downloads");
  downloads.innerHTML = "";
  const n = pyodide.runPython("len(reader.pages)");
  for (let i = 1; i <= n; i++) {
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

  document.getElementById("status").textContent = `✅ Готово: ${n} страниц`;
}
