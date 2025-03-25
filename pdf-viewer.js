// 等待页面完全加载
window.addEventListener('load', function() {
    // 初始化PDF.js
    initPDFJS();
});

// 初始化PDF.js库
function initPDFJS() {
    console.log('初始化PDF.js库');
    
    // 确保pdfjsLib已加载
    if (typeof pdfjsLib === 'undefined') {
        console.error('PDF.js库未正确加载，请检查引用');
        alert('PDF.js库未正确加载，请刷新页面重试');
        return;
    }
    
    try {
        // 设置worker路径 - 使用从pdfjs-dist导入的worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // 在生产环境中使用打包的worker
        if (process.env.NODE_ENV === 'production') {
            // Parcel会处理这个import并打包worker
            import('pdfjs-dist/build/pdf.worker.js').then(worker => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
            });
        }
        
        console.log('PDF.js Worker设置完成');
        
        // 初始化查看器
        initViewer();
    } catch (error) {
        console.error('PDF.js初始化错误:', error);
        alert('PDF.js初始化错误: ' + error.message);
    }
}

// 初始化PDF查看器
function initViewer() {
    // 全局变量
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.0;
    let canvas = document.getElementById('pdf-viewer');
    let ctx = canvas.getContext('2d');
    let spinner = document.getElementById('spinner');
    let currentPageInput = document.getElementById('current-page');
    let pageCount = document.getElementById('page-count');
    let zoomLevel = document.getElementById('zoom-level');
    let dropZone = document.getElementById('drop-zone');
    let textLayer = document.getElementById('text-layer');
    let pdfFilename = document.getElementById('pdf-filename');
    
    // 搜索相关变量
    let searchInput = document.getElementById('search-input');
    let searchPrev = document.getElementById('search-prev');
    let searchNext = document.getElementById('search-next');
    let searchResults = document.getElementById('search-results');
    let currentSearchMatches = [];
    let currentMatchIndex = -1;
    let pageTextContent = {}; // 缓存每页的文本内容

    /**
     * 显示消息通知
     * @param {string} text 消息文本
     * @param {string} type 消息类型 (info, success, error)
     */
    function showMessage(text, type = 'info') {
        console.log('显示消息:', text, type); // 调试日志
        const message = document.getElementById('message');
        const messageContent = message.querySelector('.message-content');
        
        // 设置消息内容和类型
        messageContent.textContent = text;
        message.className = `message message-${type}`;
        
        // 显示消息
        message.classList.add('show');
        
        // 3秒后自动隐藏
        setTimeout(() => {
            message.classList.remove('show');
        }, 3000);
    }

    /**
     * 更新PDF文件名显示
     * @param {string} filename 文件名
     */
    function updatePdfFilename(filename) {
        if (filename) {
            pdfFilename.textContent = filename;
            pdfFilename.title = filename; // 添加鼠标悬停提示，显示完整文件名
        } else {
            pdfFilename.textContent = '未选择文件';
            pdfFilename.title = '';
        }
    }

    /**
     * 获取页面文本内容
     * @param {number} pageNumber 页码
     * @returns {Promise<Object>} 文本内容和位置信息
     */
    async function getPageTextContent(pageNumber) {
        // 如果已缓存，直接返回
        if (pageTextContent[pageNumber]) {
            return pageTextContent[pageNumber];
        }
        
        try {
            const page = await pdfDoc.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: scale });
            
            // 缓存文本内容
            pageTextContent[pageNumber] = {
                textItems: textContent.items,
                viewport: viewport
            };
            
            return pageTextContent[pageNumber];
        } catch (error) {
            console.error('获取页面文本内容出错:', error);
            return { textItems: [], viewport: null };
        }
    }

    /**
     * 清除文本搜索结果
     */
    function clearTextLayer() {
        textLayer.innerHTML = '';
    }

    /**
     * 重置搜索状态
     */
    function resetSearch() {
        currentSearchMatches = [];
        currentMatchIndex = -1;
        searchResults.textContent = '';
        clearTextLayer();
    }

    /**
     * 清除搜索内容和高亮
     */
    function clearSearch() {
        // 清空搜索框
        searchInput.value = '';
        
        // 重置搜索状态
        resetSearch();
        
        // 显示清除搜索的消息
        showMessage('搜索已清除', 'info');
    }

    /**
     * 渲染文本匹配高亮
     */
    function renderTextMatches() {
        clearTextLayer();
        
        if (currentSearchMatches.length === 0) return;
        
        // 获取当前页的匹配项
        const pageMatches = currentSearchMatches.filter(match => match.pageNum === pageNum);
        
        if (pageMatches.length === 0) return;
        
        // 获取canvas尺寸，用于确保高亮正确定位
        const canvasRect = canvas.getBoundingClientRect();
        
        // 创建所有匹配项的高亮
        pageMatches.forEach((match, index) => {
            const globalIndex = currentSearchMatches.indexOf(match);
            const matchElement = document.createElement('div');
            matchElement.className = 'text-match';
            
            // 设置高亮位置和大小
            matchElement.style.left = `${match.left}px`;
            matchElement.style.top = `${match.top}px`;
            matchElement.style.width = `${match.width}px`;
            matchElement.style.height = `${match.height}px`;
            
            // 标记当前匹配项
            if (globalIndex === currentMatchIndex) {
                matchElement.classList.add('active');
                
                // 确保当前匹配项在视图中可见
                setTimeout(() => {
                    // 计算高亮元素相对于PDF容器的位置
                    const pdfContainer = document.querySelector('.pdf-container');
                    const containerRect = pdfContainer.getBoundingClientRect();
                    const matchRect = matchElement.getBoundingClientRect();
                    
                    // 如果高亮不在视图中，滚动到该位置
                    if (matchRect.top < containerRect.top || 
                        matchRect.bottom > containerRect.bottom ||
                        matchRect.left < containerRect.left ||
                        matchRect.right > containerRect.right) {
                        
                        // 滚动到匹配项，使其居中显示
                        matchElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                    }
                }, 100);
            }
            
            textLayer.appendChild(matchElement);
        });
        
        // 更新匹配计数
        if (currentSearchMatches.length > 0) {
            searchResults.textContent = `${currentMatchIndex + 1}/${currentSearchMatches.length}`;
        } else {
            searchResults.textContent = '无匹配';
        }
    }

    /**
     * 跳转到下一个匹配项
     */
    function goToNextMatch() {
        if (currentSearchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex + 1) % currentSearchMatches.length;
        const match = currentSearchMatches[currentMatchIndex];
        
        console.log('跳转到下一匹配项:', currentMatchIndex, '页码:', match.pageNum);
        
        // 如果匹配项在其他页面，跳转到该页面
        if (match.pageNum !== pageNum) {
            pageNum = match.pageNum;
            // 设置一个标记，表示页面渲染是由搜索引起的
            const isSearchNavigation = true;
            queueRenderPage(pageNum, isSearchNavigation);
        } else {
            // 在当前页面渲染匹配项
            renderTextMatches();
        }
    }

    /**
     * 跳转到上一个匹配项
     */
    function goToPrevMatch() {
        if (currentSearchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex - 1 + currentSearchMatches.length) % currentSearchMatches.length;
        const match = currentSearchMatches[currentMatchIndex];
        
        console.log('跳转到上一匹配项:', currentMatchIndex, '页码:', match.pageNum);
        
        // 如果匹配项在其他页面，跳转到该页面
        if (match.pageNum !== pageNum) {
            pageNum = match.pageNum;
            // 设置一个标记，表示页面渲染是由搜索引起的
            const isSearchNavigation = true;
            queueRenderPage(pageNum, isSearchNavigation);
        } else {
            // 在当前页面渲染匹配项
            renderTextMatches();
        }
    }

    /**
     * 渲染PDF页面到Canvas
     * @param {number} num 页码
     * @param {boolean} isSearchNavigation 是否是搜索导航引起的渲染
     */
    function renderPage(num, isSearchNavigation = false) {
        pageRendering = true;
        spinner.style.display = 'block';
        
        // 清除文本层
        clearTextLayer();
        
        // 获取页面
        pdfDoc.getPage(num).then(function(page) {
            // 计算缩放后的视图
            var viewport = page.getViewport({ scale: scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // 设置文本层的尺寸与Canvas一致
            textLayer.style.height = `${viewport.height}px`;
            textLayer.style.width = `${viewport.width}px`;
            
            // 渲染PDF页面
            var renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            var renderTask = page.render(renderContext);
            
            // 在每次渲染时更新当前页面的文本内容缓存
            page.getTextContent().then(function(textContent) {
                pageTextContent[num] = {
                    textItems: textContent.items,
                    viewport: viewport
                };
                
                // 处理搜索结果的更新，但避免重复搜索
                if (!isSearchNavigation && currentSearchMatches.length > 0 && searchInput.value.trim() !== '') {
                    // 仅在非搜索导航的情况下更新搜索结果位置
                    updateSearchMatchesForCurrentPage();
                }
            }).catch(function(error) {
                console.error('获取文本内容时出错:', error);
            });
            
            // 等待渲染完成
            renderTask.promise.then(function() {
                pageRendering = false;
                spinner.style.display = 'none';
                
                // 如果有搜索结果，重新渲染匹配项
                if (currentSearchMatches.length > 0) {
                    // 如果是搜索导航，直接渲染匹配项
                    renderTextMatches();
                }
                
                if (pageNumPending !== null) {
                    // 有等待的页面，渲染它
                    const pendingIsSearchNavigation = window.isSearchNavigationPending || false;
                    window.isSearchNavigationPending = false;
                    renderPage(pageNumPending, pendingIsSearchNavigation);
                    pageNumPending = null;
                }
            }).catch(function(error) {
                console.error('渲染页面时出错:', error);
                showMessage('渲染页面时出错', 'error');
                pageRendering = false;
                spinner.style.display = 'none';
            });
        }).catch(function(error) {
            console.error('获取页面时出错:', error);
            showMessage('获取页面时出错', 'error');
            pageRendering = false;
            spinner.style.display = 'none';
        });
        
        // 更新页码输入框
        currentPageInput.value = num;
    }

    /**
     * 更新当前页的搜索匹配位置而不重新执行完整搜索
     */
    function updateSearchMatchesForCurrentPage() {
        const currentQuery = searchInput.value.trim();
        if (currentQuery.length < 2) return;
        
        const savedMatchIndex = currentMatchIndex;
        
        try {
            // 仅过滤出不在当前页的匹配项
            const matchesOnOtherPages = currentSearchMatches.filter(match => match.pageNum !== pageNum);
            
            // 为当前页重新计算匹配项
            const content = pageTextContent[pageNum];
            if (!content) return;
            
            const matchesOnCurrentPage = [];
            content.textItems.forEach(item => {
                const text = item.str;
                let index = text.toLowerCase().indexOf(currentQuery.toLowerCase());
                
                while (index !== -1) {
                    // 计算匹配文本的位置和尺寸
                    const [x, y] = content.viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
                    
                    // 根据文本项的位置和大小计算匹配位置
                    const fontHeight = Math.sqrt(item.transform[2] * item.transform[2] + item.transform[3] * item.transform[3]);
                    const scaledFontHeight = fontHeight * content.viewport.scale;
                    
                    // 计算每个字符的宽度
                    const charWidth = item.width ? item.width / text.length * content.viewport.scale : scaledFontHeight * 0.6;
                    
                    matchesOnCurrentPage.push({
                        pageNum: pageNum,
                        text: text.substr(index, currentQuery.length),
                        left: x + (index * charWidth),
                        top: y - scaledFontHeight,
                        width: currentQuery.length * charWidth,
                        height: scaledFontHeight * 1.2
                    });
                    
                    // 继续在当前文本项中查找下一个匹配
                    index = text.toLowerCase().indexOf(currentQuery.toLowerCase(), index + 1);
                }
            });
            
            // 合并匹配结果
            const allMatches = [...matchesOnOtherPages, ...matchesOnCurrentPage];
            
            // 排序匹配项，确保页码顺序
            allMatches.sort((a, b) => {
                if (a.pageNum !== b.pageNum) {
                    return a.pageNum - b.pageNum;
                }
                // 同一页内按垂直位置排序
                if (Math.abs(a.top - b.top) > 5) {
                    return a.top - b.top;
                }
                // 相同垂直位置按水平位置排序
                return a.left - b.left;
            });
            
            // 更新当前搜索匹配结果
            currentSearchMatches = allMatches;
            
            // 尝试保持当前匹配项的位置，或选择最接近的
            if (savedMatchIndex >= 0 && currentSearchMatches.length > 0) {
                currentMatchIndex = Math.min(savedMatchIndex, currentSearchMatches.length - 1);
            } else if (currentSearchMatches.length > 0) {
                currentMatchIndex = 0;
            } else {
                currentMatchIndex = -1;
            }
            
            // 更新匹配显示
            if (currentSearchMatches.length > 0) {
                renderTextMatches();
            } else {
                searchResults.textContent = '无匹配';
            }
        } catch (error) {
            console.error('更新搜索匹配位置时出错:', error);
        }
    }

    /**
     * 如果有其他页面正在渲染，将页码放入队列
     * 否则立即渲染
     * @param {number} num 页码
     * @param {boolean} isSearchNavigation 是否是搜索导航引起的渲染
     */
    function queueRenderPage(num, isSearchNavigation = false) {
        if (pageRendering) {
            pageNumPending = num;
            // 存储是否是搜索导航
            window.isSearchNavigationPending = isSearchNavigation;
        } else {
            renderPage(num, isSearchNavigation);
        }
    }

    /**
     * 搜索文本
     * @param {string} query 搜索关键词
     * @returns {Promise} 搜索完成的Promise
     */
    async function searchText(query) {
        if (!pdfDoc || !query.trim()) {
            resetSearch();
            return Promise.resolve(); // 返回一个已完成的Promise
        }
        
        // 显示加载状态
        spinner.style.display = 'block';
        searchResults.textContent = '搜索中...';
        
        resetSearch();
        
        try {
            const totalPages = pdfDoc.numPages;
            const results = [];
            
            // 在所有页面中搜索文本
            for (let i = 1; i <= totalPages; i++) {
                try {
                    const { textItems, viewport } = await getPageTextContent(i);
                    
                    if (!textItems || !viewport) {
                        console.warn(`页面 ${i} 的文本内容或视图端口不可用`);
                        continue;
                    }
                    
                    // 在当前页面的文本项中搜索
                    textItems.forEach(item => {
                        if (!item || typeof item.str !== 'string') {
                            console.warn('无效的文本项:', item);
                            return;
                        }
                        
                        const text = item.str;
                        let index = text.toLowerCase().indexOf(query.toLowerCase());
                        
                        while (index !== -1) {
                            try {
                                // 检查item.transform是否有效
                                if (!item.transform || item.transform.length < 6) {
                                    console.warn('无效的文本变换:', item.transform);
                                    break;
                                }
                                
                                // 计算匹配文本的位置和尺寸
                                const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
                                
                                // 根据文本项的位置和大小计算匹配位置
                                // PDF.js中的文本位置是基线位置，需要向上偏移
                                const fontHeight = Math.sqrt(item.transform[2] * item.transform[2] + item.transform[3] * item.transform[3]);
                                const scaledFontHeight = fontHeight * viewport.scale;
                                
                                // 计算每个字符的宽度
                                const charWidth = item.width ? item.width / text.length * viewport.scale : scaledFontHeight * 0.6;
                                
                                results.push({
                                    pageNum: i,
                                    text: text.substr(index, query.length),
                                    left: x + (index * charWidth),
                                    top: y - scaledFontHeight, // 调整垂直位置，使高亮覆盖文本
                                    width: query.length * charWidth,
                                    height: scaledFontHeight * 1.2 // 稍微增加高度，确保文本被覆盖
                                });
                            } catch (err) {
                                console.error('计算匹配位置时出错:', err);
                            }
                            
                            // 继续在当前文本项中查找下一个匹配
                            index = text.toLowerCase().indexOf(query.toLowerCase(), index + 1);
                        }
                    });
                } catch (pageError) {
                    console.error(`搜索页面 ${i} 时出错:`, pageError);
                }
            }
            
            // 保存搜索结果
            currentSearchMatches = results;
            
            // 如果有匹配项，跳转到第一个
            if (results.length > 0) {
                currentMatchIndex = 0;
                
                // 如果匹配项在其他页面，跳转到该页面
                if (results[0].pageNum !== pageNum) {
                    pageNum = results[0].pageNum;
                    queueRenderPage(pageNum, true); // 传递参数表示这是搜索导航
                } else {
                    // 在当前页面渲染匹配项
                    renderTextMatches();
                }
            } else {
                searchResults.textContent = '无匹配';
            }
            
            // 隐藏加载状态
            spinner.style.display = 'none';
            
            return Promise.resolve(); // 返回一个已完成的Promise
        } catch (error) {
            console.error('搜索文本时出错:', error);
            spinner.style.display = 'none';
            searchResults.textContent = '搜索错误';
            
            return Promise.reject(error); // 返回一个被拒绝的Promise
        }
    }

    /**
     * 显示上一页
     */
    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }

    /**
     * 显示下一页
     */
    function onNextPage() {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }

    /**
     * 放大
     */
    function zoomIn() {
        scale += 0.1;
        scale = Math.min(scale, 3.0); // 最大放大3倍
        zoomLevel.textContent = Math.round(scale * 100);
        
        // 缩放改变时清除页面缓存
        pageTextContent = {};
        
        queueRenderPage(pageNum);
    }

    /**
     * 缩小
     */
    function zoomOut() {
        scale -= 0.1;
        scale = Math.max(scale, 0.5); // 最小缩小0.5倍
        zoomLevel.textContent = Math.round(scale * 100);
        
        // 缩放改变时清除页面缓存
        pageTextContent = {};
        
        queueRenderPage(pageNum);
    }

    /**
     * 处理页码输入变化
     */
    function onPageNumberChanged() {
        if (!pdfDoc) return;
        
        const newPageNum = parseInt(currentPageInput.value);
        
        if (isNaN(newPageNum)) {
            return;
        }
        
        if (newPageNum < 1 || newPageNum > pdfDoc.numPages) {
            showMessage(`请输入有效页码 (1-${pdfDoc.numPages})`, 'error');
            currentPageInput.value = pageNum;
            return;
        }
        
        pageNum = newPageNum;
        queueRenderPage(pageNum);
    }

    /**
     * 从ArrayBuffer加载PDF
     * @param {ArrayBuffer} arrayBuffer
     * @param {string} filename 文件名
     */
    function loadPdfFromArrayBuffer(arrayBuffer, filename) {
        console.log('开始加载PDF文件:', filename); // 调试日志
        spinner.style.display = 'block';
        
        // 更新文件名显示
        updatePdfFilename(filename);
        
        // 使用try-catch包裹PDF加载过程
        try {
            pdfjsLib.getDocument({ data: arrayBuffer }).promise
                .then(function(pdf) {
                    console.log('PDF加载成功, 页数:', pdf.numPages); // 调试日志
                    pdfDoc = pdf;
                    pageCount.textContent = pdf.numPages;
                    
                    // 初始化页码
                    pageNum = 1;
                    
                    // 重置缩放
                    scale = 1.0;
                    zoomLevel.textContent = Math.round(scale * 100);
                    
                    // 更新UI状态，显示PDF内容
                    document.querySelector('.pdf-container').classList.add('has-pdf');
                    canvas.classList.add('active');
                    
                    // 清除任何现有的搜索结果
                    resetSearch();
                    
                    // 渲染第一页
                    renderPage(pageNum);
                    
                    showMessage('PDF文件已加载', 'success');
                })
                .catch(function(error) {
                    console.error('加载PDF文件时出错:', error);
                    showMessage('加载PDF文件时出错: ' + error.message, 'error');
                    spinner.style.display = 'none';
                    resetPdfView();
                });
        } catch (error) {
            console.error('处理PDF文件时发生异常:', error);
            showMessage('处理PDF文件时发生异常: ' + error.message, 'error');
            spinner.style.display = 'none';
            resetPdfView();
        }
    }

    /**
     * 重置PDF视图状态
     */
    function resetPdfView() {
        // 清除PDF文档引用
        pdfDoc = null;
        
        // 重置UI
        document.querySelector('.pdf-container').classList.remove('has-pdf');
        canvas.classList.remove('active');
        
        // 清除canvas内容
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 重置页码显示
        pageCount.textContent = '0';
        currentPageInput.value = '1';
        
        // 重置文件名
        updatePdfFilename('');
        
        // 重置搜索
        resetSearch();
        searchInput.value = '';
    }

    /**
     * 处理文件选择
     */
    function onFileSelected(event) {
        console.log('文件选择事件触发'); // 调试日志
        const file = event.target.files[0];
        
        if (!file) {
            console.log('没有选择文件'); // 调试日志
            return;
        }
        
        console.log('选择的文件:', file.name, file.type, file.size); // 调试日志
        
        if (file.type !== 'application/pdf') {
            showMessage('请选择有效的PDF文件', 'error');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            console.log('文件读取完成, 大小:', e.target.result.byteLength); // 调试日志
            loadPdfFromArrayBuffer(e.target.result, file.name);
        };
        
        reader.onerror = function(e) {
            console.error('读取文件时出错:', e); // 调试日志
            showMessage('读取文件时出错', 'error');
        };
        
        console.log('开始读取文件'); // 调试日志
        reader.readAsArrayBuffer(file);
    }

    /**
     * 处理键盘事件
     */
    function handleKeyboardNavigation(event) {
        // 如果正在编辑页码输入框，不处理键盘导航
        if (document.activeElement === currentPageInput) {
            return;
        }
        
        switch (event.key) {
            case 'ArrowLeft':
            case 'Left':
                onPrevPage();
                event.preventDefault();
                break;
            case 'ArrowRight':
            case 'Right':
                onNextPage();
                event.preventDefault();
                break;
            case '+':
            case '=':
                zoomIn();
                event.preventDefault();
                break;
            case '-':
                zoomOut();
                event.preventDefault();
                break;
            case 'Home':
                if (pdfDoc) {
                    pageNum = 1;
                    queueRenderPage(pageNum);
                    event.preventDefault();
                }
                break;
            case 'End':
                if (pdfDoc) {
                    pageNum = pdfDoc.numPages;
                    queueRenderPage(pageNum);
                    event.preventDefault();
                }
                break;
        }
    }

    /**
     * 处理拖放相关事件
     */
    function setupDragAndDrop() {
        // 拖放状态标志，防止重复触发
        let isDragging = false;
        
        // 阻止默认拖放事件
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // 高亮显示拖放区域 - 仅在进入时设置一次
        dropZone.addEventListener('dragenter', function(e) {
            preventDefaults(e);
            if (!isDragging) {
                isDragging = true;
                highlight();
            }
        }, false);
        
        // 保持拖放区域高亮状态
        dropZone.addEventListener('dragover', function(e) {
            preventDefaults(e);
            if (!isDragging) {
                isDragging = true;
                highlight();
            }
            // 阻止事件冒泡，防止闪烁
            e.stopPropagation();
        }, false);

        // 取消高亮显示 - 使用定时器避免闪烁
        let leaveTimer;
        dropZone.addEventListener('dragleave', function(e) {
            preventDefaults(e);
            
            // 检查是否真的离开了元素（而不是进入了子元素）
            if (!isChild(e.target, e.relatedTarget)) {
                // 清除之前的定时器
                clearTimeout(leaveTimer);
                
                // 添加短暂延迟，避免闪烁
                leaveTimer = setTimeout(function() {
                    isDragging = false;
                    unhighlight();
                }, 50);
            }
        }, false);

        // 处理文件拖放
        dropZone.addEventListener('drop', function(e) {
            preventDefaults(e);
            isDragging = false;
            unhighlight();
            
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length) {
                handleFiles(files);
            }
        }, false);
        
        // 点击拖放区域也能选择文件
        dropZone.addEventListener('click', function() {
            document.getElementById('file-input').click();
        });

        // 检查一个元素是否是另一个元素的子元素
        function isChild(child, parent) {
            if (!parent) return false;
            
            let node = child.parentNode;
            while (node) {
                if (node === parent) {
                    return true;
                }
                node = node.parentNode;
            }
            return false;
        }

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight() {
            dropZone.classList.add('drag-over');
        }

        function unhighlight() {
            dropZone.classList.remove('drag-over');
        }
        
        function handleFiles(files) {
            const file = files[0];
            if (file && file.type === 'application/pdf') {
                // 添加成功视觉反馈
                dropZone.classList.add('active');
                setTimeout(() => {
                    dropZone.classList.remove('active');
                    // 加载文件
                    onFileSelected({ target: { files: [file] } });
                }, 300);
            } else {
                showMessage('请选择有效的PDF文件', 'error');
            }
        }
        
        // 处理document的drag事件，确保拖放区域外取消高亮
        document.addEventListener('dragenter', function(e) {
            // 如果不是拖入到dropZone，确保不显示高亮
            if (e.target !== dropZone && !dropZone.contains(e.target)) {
                isDragging = false;
                unhighlight();
            }
        }, false);
        
        document.addEventListener('dragleave', function(e) {
            // 如果是离开窗口，取消高亮
            if (e.clientX <= 0 || e.clientY <= 0 || 
                e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                isDragging = false;
                unhighlight();
            }
        }, false);
    }

    // 添加事件监听
    document.getElementById('prev-page').addEventListener('click', onPrevPage);
    document.getElementById('next-page').addEventListener('click', onNextPage);
    document.getElementById('zoom-in').addEventListener('click', zoomIn);
    document.getElementById('zoom-out').addEventListener('click', zoomOut);
    document.getElementById('file-input').addEventListener('change', onFileSelected);
    currentPageInput.addEventListener('change', onPageNumberChanged);
    
    // 添加键盘导航
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // 确保文件选择按钮也可以触发文件选择
    document.getElementById('select-file-btn').addEventListener('click', function() {
        document.getElementById('file-input').click();
    });
    
    // 设置拖放功能
    setupDragAndDrop();
    
    // 添加搜索功能事件监听
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length >= 2) { // 最少2个字符才开始搜索
            searchText(query);
        } else {
            resetSearch();
        }
    });
    
    searchNext.addEventListener('click', goToNextMatch);
    searchPrev.addEventListener('click', goToPrevMatch);
    
    // 添加搜索清除按钮点击事件
    document.getElementById('search-clear').addEventListener('click', clearSearch);
    
    // 添加搜索快捷键
    document.addEventListener('keydown', function(e) {
        // Ctrl+F: 聚焦搜索框
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
        
        // F3 或 Ctrl+G: 查找下一个
        if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
            e.preventDefault();
            goToNextMatch();
        }
        
        // Shift+F3 或 Ctrl+Shift+G: 查找上一个
        if ((e.key === 'F3' && e.shiftKey) || (e.ctrlKey && e.shiftKey && e.key === 'g')) {
            e.preventDefault();
            goToPrevMatch();
        }
        
        // Enter: 在搜索框中按下Enter键时查找下一个
        if (e.key === 'Enter' && document.activeElement === searchInput) {
            e.preventDefault();
            goToNextMatch();
        }
        
        // Escape: 清除搜索
        if (e.key === 'Escape' && (document.activeElement === searchInput || currentSearchMatches.length > 0)) {
            e.preventDefault();
            clearSearch();
        }
    });
    
    // 监听窗口大小变化，重新渲染当前页
    let resizeTimeout;
    window.addEventListener('resize', function() {
        // 防抖，避免频繁渲染
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            if (pdfDoc) {
                // 重新渲染当前页
                queueRenderPage(pageNum);
            }
        }, 300);
    });
    
    console.log('PDF预览器初始化完成');
    
    // 立即初始化视图状态
    resetPdfView();
    
    // 启动时显示提示消息
    setTimeout(function() {
        showMessage('请选择一个PDF文件进行查看', 'info');
    }, 500);
} 