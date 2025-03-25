// 导入PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// 设置全局变量，以便pdf-viewer.js可以访问
window.pdfjsLib = pdfjsLib;

// 导入我们的PDF查看器代码
import './pdf-viewer.js'; 