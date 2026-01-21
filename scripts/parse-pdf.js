const pdfParseModule = require('pdf-parse');
const fs = require('fs');

async function parsePDF(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  
  // Пробуем использовать как функцию (старые версии)
  if (typeof pdfParseModule === 'function') {
    const data = await pdfParseModule(dataBuffer);
    return data.text;
  }
  
  // Пробуем использовать default export
  if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
    const data = await pdfParseModule.default(dataBuffer);
    return data.text;
  }
  
  // Пробуем использовать класс PDFParse (новые версии)
  if (pdfParseModule.PDFParse && typeof pdfParseModule.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    return result.text;
  }
  
  throw new Error('Не удалось определить способ использования pdf-parse');
}

module.exports = { parsePDF };
