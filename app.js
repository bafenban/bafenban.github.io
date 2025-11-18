// app.js (完整内容，支持流式输出、定制配置和本地存储)

// 1. 数据定义与常量
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const LANGUAGE_OPTIONS = {
    "Auto Detect": "自动检测",
    "Simplified Chinese": "简体中文",
    "English": "英文",
    "Japanese": "日文",
    "Korean": "韩文",
    "Traditional Chinese": "繁体中文",
    "French": "法文",
    "German": "德文",
    "Spanish": "西班牙文",
    "Russian": "俄文",
};

const MODEL_OPTIONS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "gpt-4-0613",
    "gpt-3.5-turbo-16k"
];


// 2. 获取所有 DOM 元素
const translateButton = document.getElementById('translateButton');
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const statusMessage = document.getElementById('statusMessage');

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
    
    // 4.4 初始状态
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

        if (useStreaming) {
            // --------------------- 流式处理逻辑 ---------------------
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = '';
            
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
                                fullText += content;
                                outputText.value = fullText;
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
            const translatedText = data.choices[0].message.content.trim(); 
            outputText.value = translatedText;
            setStatus("✅ 翻译完成！", true);
            // --------------------- 非流式处理逻辑结束 ---------------------
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

// 7. 事件监听器

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