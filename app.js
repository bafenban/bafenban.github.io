// app.js (完整内容，支持流式输出、定制配置、本地存储和历史记录)

// 1. 数据定义与常量
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const HISTORY_KEY = 'translationHistory'; // 历史记录的本地存储键
const MAX_HISTORY_SIZE = 10; // 最大历史记录条数

const LANGUAGE_OPTIONS = {
    "Auto Detect": "自动检测",
    "Simplified Chinese": "简体中文",
    "English": "英文",
    "Japanese": "日文",
    "Traditional Chinese": "繁体中文",
};

const MODEL_OPTIONS = [
    "gpt-5.1",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini"
];


// 2. 获取所有 DOM 元素
const translateButton = document.getElementById('translateButton');
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const statusMessage = document.getElementById('statusMessage');

// 输入/输出框辅助按钮
const clearInputButton = document.getElementById('clearInputButton');
const copyOutputButton = document.getElementById('copyOutputButton');

// API 配置输入字段
const apiEndpointInput = document.getElementById('apiEndpoint');
const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('modelSelect');
const temperatureInput = document.getElementById('temperatureInput');
const streamingModeCheckbox = document.getElementById('streamingModeCheckbox'); 
const resetUrlButton = document.getElementById('resetUrlButton'); 

// 语言选择字段
const sourceLangSelect = document.getElementById('sourceLangSelect');
const targetLangSelect = document.getElementById('targetLangSelect');
const swapButton = document.getElementById('swapButton');

// 历史记录字段
const historyList = document.getElementById('historyList');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const historyCountSpan = document.getElementById('historyCount');


// 3. 辅助函数：显示/隐藏状态信息
function setStatus(message, isHidden = false, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('status-hidden', isHidden);
    statusMessage.style.color = isError ? '#dc3545' : '#17a2b8';
}

// 4. 初始化函数
function initializeApp() {
    // 4.1 填充语言选择器
    const createOption = (value, text) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    };

    Object.keys(LANGUAGE_OPTIONS).forEach(langKey => {
        const langText = LANGUAGE_OPTIONS[langKey];
        sourceLangSelect.appendChild(createOption(langKey, langText));
        targetLangSelect.appendChild(createOption(langKey, langText));
    });

    // 4.2 填充模型选择器
    MODEL_OPTIONS.forEach(modelName => {
        modelSelect.appendChild(createOption(modelName, modelName));
    });

    // 4.3 加载保存的配置
    loadSettings();
    
    // 4.4 加载并渲染历史记录
    renderHistory();

    // 4.5 初始状态
    setStatus("", true); 
}

// 5. 配置存储/加载
function loadSettings() {
    // API & Model Settings
    const savedEndpoint = localStorage.getItem('llmEndpoint') || apiEndpointInput.value;
    const savedKey = localStorage.getItem('llmKey');
    const savedModel = localStorage.getItem('llmModel') || modelSelect.value;
    const savedTemp = localStorage.getItem('llmTemp') || temperatureInput.value;
    const savedStreaming = localStorage.getItem('streamingMode') === 'true';

    apiEndpointInput.value = savedEndpoint;
    if (savedKey) apiKeyInput.value = savedKey; 
    if (modelSelect.querySelector(`option[value="${savedModel}"]`)) {
        modelSelect.value = savedModel;
    }
    temperatureInput.value = savedTemp;
    streamingModeCheckbox.checked = savedStreaming; 

    // Language Settings (默认源语言：自动检测，目标语言：简体中文)
    const savedSource = localStorage.getItem('sourceLang') || "Auto Detect";
    const savedTarget = localStorage.getItem('targetLang') || "Simplified Chinese";
    
    if (sourceLangSelect.querySelector(`option[value="${savedSource}"]`)) {
        sourceLangSelect.value = savedSource;
    }
    if (targetLangSelect.querySelector(`option[value="${savedTarget}"]`)) {
        targetLangSelect.value = savedTarget;
    }
}

function saveSetting(key, value) {
    localStorage.setItem(key, value);
}

// 5.1 历史记录管理函数
function loadHistory() {
    try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        // 历史记录存储为数组，并确保是有效的 JSON 格式
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
        console.error("加载历史记录失败:", e);
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// 添加历史记录条目
function addHistoryEntry(sourceText, targetText, sourceLang, targetLang) {
    let history = loadHistory();
    
    const newEntry = {
        source: sourceText,
        translation: targetText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        timestamp: new Date().toISOString(),
    };

    // 检查是否重复（简化：只检查最近一条记录的文本是否完全相同）
    if (history.length > 0 && 
        history[0].source === sourceText && 
        history[0].translation === targetText) {
        // 如果与最新记录重复，则不添加
        return;
    }
    
    // 将新条目添加到数组开头
    history.unshift(newEntry);

    // 保持最大记录数
    if (history.length > MAX_HISTORY_SIZE) {
        history = history.slice(0, MAX_HISTORY_SIZE);
    }

    saveHistory(history);
    renderHistory(); // 重新渲染列表
}

// 渲染历史记录列表
function renderHistory() {
    const history = loadHistory();
    historyList.innerHTML = ''; // 清空现有列表
    
    historyCountSpan.textContent = `${history.length} 条记录`;
    
    if (history.length === 0) {
        historyList.innerHTML = '<li style="text-align: center; color: #999; padding: 10px;">暂无翻译记录</li>';
        return;
    }

    history.forEach((entry, index) => {
        const li = document.createElement('li');
        li.classList.add('history-item');
        // 将完整的历史记录对象存储在 DOM 元素上，方便点击时读取
        li.dataset.index = index; 
        
        // 截断文本以适应列表显示
        const SOURCE_LIMIT = 50;
        const TRANSLATION_LIMIT = 50;

        const sourceDisplay = entry.source.length > SOURCE_LIMIT ? entry.source.substring(0, SOURCE_LIMIT) + '...' : entry.source;
        const translationDisplay = entry.translation.length > TRANSLATION_LIMIT ? entry.translation.substring(0, TRANSLATION_LIMIT) + '...' : entry.translation;

        const sourceLangText = LANGUAGE_OPTIONS[entry.sourceLang] || entry.sourceLang;
        const targetLangText = LANGUAGE_OPTIONS[entry.targetLang] || entry.targetLang;

        li.innerHTML = `
            <span class="history-item-source" title="${entry.source}">[${sourceLangText} -> ${targetLangText}] ${sourceDisplay}</span>
            <span class="history-item-translation" title="${entry.translation}">${translationDisplay}</span>
        `;
        
        historyList.appendChild(li);
    });
}


// 6. 核心功能：调用 LLM API (支持流式和非流式)
async function callLLMForTranslation(text, endpoint, key, model, temperature, sourceLang, targetLang, useStreaming) {
    if (!endpoint || !key || !model) {
        setStatus("❌ 错误：请检查 API 密钥、终端点或模型是否填写完整。", false, true);
        return;
    }

    setStatus(`🚀 正在使用 ${model} 模型请求翻译...`, false);
    outputText.value = '';

    const sourceText = sourceLang === "Auto Detect" ? "源语言" : LANGUAGE_OPTIONS[sourceLang];
    const targetText = LANGUAGE_OPTIONS[targetLang];
    const systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本从 ${sourceText} 翻译成 ${targetText}。只返回翻译结果，不要添加任何解释、前缀或额外内容。`;

    try {
        const tempValue = parseFloat(temperature);
        
        const requestBody = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `请翻译以下文本: ${text}` }
            ],
            temperature: isNaN(tempValue) ? 0.7 : tempValue,
            stream: useStreaming 
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}` 
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error ? errorData.error.message : response.statusText;
            throw new Error(`API 错误: ${errorMessage} (HTTP ${response.status})`);
        }

        let translatedText = '';
        
        if (useStreaming) {
            // --------------------- 流式处理逻辑 ---------------------
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            
            setStatus("📝 正在流式接收翻译结果...", false);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]') continue;
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            const content = data.choices[0]?.delta?.content;
                            
                            if (content) {
                                translatedText += content;
                                outputText.value = translatedText;
                                outputText.scrollTop = outputText.scrollHeight; 
                            }
                        } catch (e) {
                            // 忽略不完整的 JSON 块
                        }
                    }
                }
            }
            setStatus("✅ 翻译完成！", true);
            // --------------------- 流式处理逻辑结束 ---------------------
        } else {
            // --------------------- 非流式处理逻辑 ---------------------
            const data = await response.json();
            translatedText = data.choices[0].message.content.trim(); 
            outputText.value = translatedText;
            setStatus("✅ 翻译完成！", true);
            // --------------------- 非流式处理逻辑结束 ---------------------
        }

        // 7. 翻译成功后：添加历史记录
        if (translatedText.length > 0) {
            addHistoryEntry(text, translatedText, sourceLang, targetLang);
        }

    } catch (error) {
        console.error('翻译过程中发生错误:', error);
        outputText.value = `翻译失败。请检查 API 配置、模型或网络连接。详细错误：${error.message}`;
        setStatus(`❌ 翻译失败: ${error.message.substring(0, 80)}...`, false, true);
    } finally {
        translateButton.disabled = false;
        translateButton.textContent = '开始翻译';
    }
}

// 8. 事件监听器

// 翻译按钮点击事件
translateButton.addEventListener('click', () => {
    const textToTranslate = inputText.value.trim();
    
    const userEndpoint = apiEndpointInput.value.trim();
    const userKey = apiKeyInput.value.trim();
    const userModel = modelSelect.value;
    const userTemperature = temperatureInput.value;
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;
    const useStreaming = streamingModeCheckbox.checked;

    if (textToTranslate === "") {
        setStatus("🤔 请输入要翻译的文本。", false);
        return;
    }
    
    translateButton.disabled = true;
    translateButton.textContent = useStreaming ? '正在连接...' : '正在翻译...';

    callLLMForTranslation(
        textToTranslate, 
        userEndpoint, 
        userKey, 
        userModel, 
        userTemperature,
        sourceLang,
        targetLang,
        useStreaming 
    );
});

// 新增：清除输入按钮事件
clearInputButton.addEventListener('click', () => {
    inputText.value = '';
    setStatus("输入文本已清除。", false);
});

// 新增：复制输出按钮事件
copyOutputButton.addEventListener('click', () => {
    const textToCopy = outputText.value;
    if (textToCopy.trim() === "") {
        setStatus("📋 复制失败：没有可复制的翻译结果。", false, true);
        return;
    }
    
    // 使用 document.execCommand('copy') 实现跨浏览器复制（适用于iframe环境）
    // 为了让 execCommand 成功，需要选择一些内容。这里通过创建一个临时 textarea 来实现。
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = textToCopy;
    // 隐藏元素但保持可操作性
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.opacity = '0'; 
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    try {
        const success = document.execCommand('copy');
        if (success) {
            setStatus("✅ 翻译结果已成功复制到剪贴板！", false);
        } else {
            throw new Error("浏览器不支持execCommand('copy')");
        }
    } catch (err) {
        console.error('复制操作失败:', err);
        setStatus("❌ 复制失败，请手动复制。", false, true);
    } finally {
        document.body.removeChild(tempTextarea);
    }
});


// 重置 URL 按钮事件
resetUrlButton.addEventListener('click', () => {
    apiEndpointInput.value = DEFAULT_ENDPOINT;
    saveSetting('llmEndpoint', DEFAULT_ENDPOINT);
    setStatus("API 终端点已重置为默认值。", false);
});


// 语言互换按钮事件
swapButton.addEventListener('click', () => {
    const currentSource = sourceLangSelect.value;
    const currentTarget = targetLangSelect.value;
    
    sourceLangSelect.value = currentTarget;
    targetLangSelect.value = currentSource;

    const currentInputText = inputText.value;
    const currentOutputText = outputText.value;
    inputText.value = currentOutputText;
    outputText.value = currentInputText;

    saveSetting('sourceLang', currentTarget);
    saveSetting('targetLang', currentSource);
    setStatus("语言方向已互换。", false);
});


// 历史记录列表点击事件：加载记录到文本框
historyList.addEventListener('click', (event) => {
    const item = event.target.closest('.history-item');
    if (!item) return;

    const index = parseInt(item.dataset.index);
    const history = loadHistory();
    const entry = history[index];

    if (entry) {
        // 1. 加载源文本和目标文本
        inputText.value = entry.source;
        outputText.value = entry.translation;

        // 2. 加载语言设置
        sourceLangSelect.value = entry.sourceLang;
        targetLangSelect.value = entry.targetLang;
        
        // 3. 保存语言设置到本地存储
        saveSetting('sourceLang', entry.sourceLang);
        saveSetting('targetLang', entry.targetLang);

        setStatus(`已加载历史记录：[${LANGUAGE_OPTIONS[entry.sourceLang] || entry.sourceLang} -> ${LANGUAGE_OPTIONS[entry.targetLang] || entry.targetLang}]`, false);
    }
});

// 清空历史记录按钮事件
clearHistoryButton.addEventListener('click', () => {
    
    const currentHistory = loadHistory();
    if (currentHistory.length === 0) {
        setStatus("❌ 历史记录已经是空的了。", false, true);
        return;
    }
    
    // 实际执行清除
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    setStatus("✅ 历史记录已清空。", false);
});


// 配置输入变化时，自动保存到本地存储
apiEndpointInput.addEventListener('input', () => saveSetting('llmEndpoint', apiEndpointInput.value.trim()));
apiKeyInput.addEventListener('input', () => saveSetting('llmKey', apiKeyInput.value.trim()));
modelSelect.addEventListener('change', () => saveSetting('llmModel', modelSelect.value));
temperatureInput.addEventListener('input', () => saveSetting('llmTemp', temperatureInput.value));
streamingModeCheckbox.addEventListener('change', () => saveSetting('streamingMode', streamingModeCheckbox.checked));
sourceLangSelect.addEventListener('change', () => saveSetting('sourceLang', sourceLangSelect.value));
targetLangSelect.addEventListener('change', () => saveSetting('targetLang', targetLangSelect.value));


// 页面加载时运行初始化
window.onload = initializeApp;
