
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Mostra aviso em mobile se não houver interação
window.addEventListener('load', () => {
    if (isMobileDevice() && !userInteracted) {
        const hint = document.getElementById('mobileVoiceHint');
        if (hint) hint.style.display = 'block';
    }
});


        // Configuração do PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Variáveis globais
        let pdfDoc = null;
        let fontSize = 16;
        let currentFileName = '';
        let extractedText = '';
        let selectedText = '';
        let isReading = false;
        let isPaused = false;
        let currentUtterance = null;
        let availableVoices = [];
        let isFullscreenMode = false;
        let quickPanelOpen = false;
        let speechSynthesisReady = false;
        let userInteracted = false;
        let debugMode = false;
        let voiceLoadAttempts = 0;
        let maxVoiceLoadAttempts = 10;

        // Configurações TTS
        let ttsSettings = {
            rate: 1,
            pitch: 1,
            volume: 1,
            voice: ''
        };

        // Elementos DOM
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const readerContainer = document.getElementById('readerContainer');
        const readerContent = document.getElementById('readerContent');
        const loading = document.getElementById('loading');
        const pageInfo = document.getElementById('pageInfo');
        const fileName = document.getElementById('fileName');
        const fontSizeDisplay = document.getElementById('fontSizeDisplay');
        const readingProgress = document.getElementById('readingProgress');
        const header = document.getElementById('header');
        const mainContent = document.getElementById('mainContent');
        const ttsControls = document.getElementById('ttsControls');
        const ttsToggle = document.getElementById('ttsToggle');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const voiceSelect = document.getElementById('voiceSelect');
        const rateSlider = document.getElementById('rateSlider');
        const volumeSlider = document.getElementById('volumeSlider');
        const rateValue = document.getElementById('rateValue');
        const volumeValue = document.getElementById('volumeValue');
        const selectedTextPreview = document.getElementById('selectedTextPreview');
        const selectedTextContent = document.getElementById('selectedTextContent');
        const readSelectionBtn = document.getElementById('readSelectionBtn');
        const themeToggle = document.getElementById('themeToggle');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const floatingControls = document.getElementById('floatingControls');
        const quickPanel = document.getElementById('quickPanel');
        const floatingPlayBtn = document.getElementById('floatingPlayBtn');
        const debugInfo = document.getElementById('debugInfo');
        const voiceLoading = document.getElementById('voiceLoading');
        const loadVoicesBtn = document.getElementById('loadVoicesBtn');

        // Quick panel elements
        const quickFontSize = document.getElementById('quickFontSize');
        const quickVoiceSelect = document.getElementById('quickVoiceSelect');
        const quickRateSlider = document.getElementById('quickRateSlider');
        const quickVolumeSlider = document.getElementById('quickVolumeSlider');
        const quickRateValue = document.getElementById('quickRateValue');
        const quickVolumeValue = document.getElementById('quickVolumeValue');
        const quickPlayIcon = document.getElementById('quickPlayIcon');
        const quickPlayText = document.getElementById('quickPlayText');
        const quickThemeIcon = document.getElementById('quickThemeIcon');

        // Debug function
        function updateDebugInfo() {
            if (!debugMode) return;
            
            const info = {
                userAgent: navigator.userAgent.substring(0, 50) + '...',
                isFullscreen: isFullscreenMode,
                isReading: isReading,
                isPaused: isPaused,
                speechSynthesisReady: speechSynthesisReady,
                userInteracted: userInteracted,
                voicesCount: availableVoices.length,
                voiceLoadAttempts: voiceLoadAttempts,
                currentVoice: ttsSettings.voice,
                speechSynthesisState: {
                    speaking: speechSynthesis.speaking,
                    pending: speechSynthesis.pending,
                    paused: speechSynthesis.paused
                },
                extractedTextLength: extractedText.length,
                selectedTextLength: selectedText.length,
                speechSynthesisSupported: 'speechSynthesis' in window,
                voicesChangedFired: voiceLoadAttempts > 0
            };
            
            debugInfo.innerHTML = Object.entries(info)
                .map(([key, value]) => `<strong>${key}:</strong> ${JSON.stringify(value)}`)
                .join('<br>');
        }

        function toggleDebugInfo() {
            debugMode = !debugMode;
            debugInfo.classList.toggle('show', debugMode);
            if (debugMode) {
                updateDebugInfo();
                setInterval(updateDebugInfo, 1000);
            }
        }

        // Detectar interação do usuário
        function markUserInteraction() {
            if (!userInteracted) {
                userInteracted = true;
                updateDebugInfo();
                console.log('User interaction detected');
                
                // Tentar carregar vozes após primeira interação
                setTimeout(() => {
                    forceLoadVoices();
                }, 100);
            }
        }

        // Event listeners para detectar interação
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, markUserInteraction, { once: false });
        });

        // Event listeners
        fileInput.addEventListener('change', handleFileSelect);
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('drop', handleDrop);
        uploadArea.addEventListener('click', () => fileInput.click());
        readerContainer.addEventListener('scroll', updateReadingProgress);
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('keyup', handleTextSelection);
        document.addEventListener('keydown', handleKeyboardShortcuts);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // Touch events for mobile
        let touchStartY = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
            markUserInteraction();
        });

        document.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartY - touchEndY;

            if (isFullscreenMode && Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe up - show floating controls
                    floatingControls.classList.add('show');
                    setTimeout(() => {
                        if (!quickPanelOpen) {
                            floatingControls.classList.remove('show');
                        }
                    }, 3000);
                }
            }
        }

        // Função melhorada para carregar vozes
        function loadVoices() {
            voiceLoadAttempts++;
            console.log(`Loading voices attempt ${voiceLoadAttempts}`);
            
            const voices = speechSynthesis.getVoices();
            console.log(`Found ${voices.length} voices`);
            
            if (voices.length > 0) {
                availableVoices = voices;
                speechSynthesisReady = true;
                voiceLoading.classList.add('hidden');
                
                populateVoiceSelect();
                populateQuickVoiceSelect();
                
                // Selecionar voz em português por padrão
                if (!ttsSettings.voice) {
                    const portugueseVoice = availableVoices.find(voice => 
                        voice.lang.includes('pt') || voice.lang.includes('PT') ||
                        voice.name.toLowerCase().includes('portuguese') ||
                        voice.name.toLowerCase().includes('brasil')
                    );
                    
                    if (portugueseVoice) {
                        ttsSettings.voice = portugueseVoice.name;
                        voiceSelect.value = portugueseVoice.name;
                        quickVoiceSelect.value = portugueseVoice.name;
                        console.log('Selected Portuguese voice:', portugueseVoice.name);
                    } else if (availableVoices.length > 0) {
                        // Fallback para primeira voz disponível
                        ttsSettings.voice = availableVoices[0].name;
                        voiceSelect.value = availableVoices[0].name;
                        quickVoiceSelect.value = availableVoices[0].name;
                        console.log('Selected fallback voice:', availableVoices[0].name);
                    }
                }
                
                updateDebugInfo();
                console.log(`Successfully loaded ${voices.length} voices`);
                
                // Mostrar sucesso
                showSuccess(`${voices.length} vozes carregadas com sucesso!`);
                
            } else if (voiceLoadAttempts < maxVoiceLoadAttempts) {
                // Retry com delay progressivo
                const delay = Math.min(voiceLoadAttempts * 200, 2000);
                console.log(`No voices found, retrying in ${delay}ms`);
                setTimeout(loadVoices, delay);
            } else {
                console.error('Failed to load voices after maximum attempts');
                voiceLoading.classList.add('hidden');
                showError('Não foi possível carregar as vozes. Verifique se seu navegador suporta síntese de voz.');
                
                // Adicionar opção manual
                populateVoiceSelectWithDefault();
            }
        }

        function populateVoiceSelect() {
            voiceSelect.innerHTML = '';
            if (availableVoices.length === 0) {
                voiceSelect.innerHTML = '<option value="">Nenhuma voz disponível</option>';
                return;
            }
            
            availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                voiceSelect.appendChild(option);
            });
        }

        function populateQuickVoiceSelect() {
            quickVoiceSelect.innerHTML = '';
            if (availableVoices.length === 0) {
                quickVoiceSelect.innerHTML = '<option value="">Nenhuma voz disponível</option>';
                return;
            }
            
            availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                quickVoiceSelect.appendChild(option);
            });
        }

        function populateVoiceSelectWithDefault() {
            voiceSelect.innerHTML = '<option value="">Voz padrão do sistema</option>';
            quickVoiceSelect.innerHTML = '<option value="">Voz padrão do sistema</option>';
            ttsSettings.voice = '';
        }

        // Função para forçar carregamento de vozes
        function forceLoadVoices() {
            console.log('Force loading voices...');
            voiceLoading.classList.remove('hidden');
            voiceLoadAttempts = 0;
            speechSynthesisReady = false;
            availableVoices = [];
            
            // Múltiplas estratégias para carregar vozes
            
            // Estratégia 1: Cancelar e tentar novamente
            speechSynthesis.cancel();
            
            // Estratégia 2: Criar utterance vazia para forçar carregamento
            const testUtterance = new SpeechSynthesisUtterance('');
            testUtterance.volume = 0;
            testUtterance.rate = 10; // Muito rápido para terminar logo
            speechSynthesis.speak(testUtterance);
            
            setTimeout(() => {
                speechSynthesis.cancel();
                loadVoices();
            }, 100);
            
            // Estratégia 3: Tentar após delay
            setTimeout(() => {
                if (!speechSynthesisReady) {
                    loadVoices();
                }
            }, 500);
            
            // Estratégia 4: Tentar após delay maior
            setTimeout(() => {
                if (!speechSynthesisReady) {
                    loadVoices();
                }
            }, 1500);
        }

        // Função para testar voz
        function testSpeech() {
            markUserInteraction();
            
            if (!speechSynthesisReady && availableVoices.length === 0) {
                showError('Nenhuma voz disponível. Tente recarregar as vozes primeiro.');
                return;
            }
            
            const testText = 'Teste de síntese de voz. Se você está ouvindo isso, a voz está funcionando corretamente.';
            
            const utterance = new SpeechSynthesisUtterance(testText);
            
            if (ttsSettings.voice && availableVoices.length > 0) {
                const selectedVoice = availableVoices.find(voice => voice.name === ttsSettings.voice);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }
            
            utterance.rate = ttsSettings.rate;
            utterance.volume = ttsSettings.volume;
            
            utterance.onstart = () => {
                showSuccess('Teste de voz iniciado!');
            };
            
            utterance.onend = () => {
                showSuccess('Teste de voz concluído!');
            };
            
            utterance.onerror = (event) => {
                showError(`Erro no teste de voz: ${event.error}`);
            };
            
            speechSynthesis.speak(utterance);
        }

        // Carregar vozes quando disponíveis
        speechSynthesis.addEventListener('voiceschanged', loadVoices);
        
        // Tentar carregar vozes imediatamente
        setTimeout(loadVoices, 100);

        // Retry loading voices after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (!speechSynthesisReady) {
                    forceLoadVoices();
                }
            }, 1000);
        });

        // Tentar carregar vozes periodicamente se não conseguiu
        setInterval(() => {
            if (!speechSynthesisReady && voiceLoadAttempts < maxVoiceLoadAttempts) {
                loadVoices();
            }
        }, 3000);

        function handleFileSelect(event) {
            markUserInteraction();
            const file = event.target.files[0];
            if (file && file.type === 'application/pdf') {
                loadPDF(file);
            } else {
                showError('Por favor, selecione um arquivo PDF válido.');
            }
        }

        function handleDragOver(event) {
            event.preventDefault();
            uploadArea.classList.add('dragover');
        }

        function handleDrop(event) {
            event.preventDefault();
            markUserInteraction();
            uploadArea.classList.remove('dragover');
            const files = event.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                loadPDF(files[0]);
            } else {
                showError('Por favor, arraste um arquivo PDF válido.');
            }
        }

        async function loadPDF(file) {
            try {
                currentFileName = file.name;
                fileName.textContent = currentFileName;
                uploadArea.style.display = 'none';
                readerContainer.style.display = 'block';
                loading.classList.remove('hidden');
                readerContent.innerHTML = '';

                const arrayBuffer = await file.arrayBuffer();
                pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
                await extractAllText();
                
                loading.classList.add('hidden');
                pageInfo.textContent = `Texto extraído de ${pdfDoc.numPages} páginas`;
                ttsToggle.style.display = 'block';
                updateStatusIndicator('stopped');
                updateDebugInfo();
                
                // Tentar carregar vozes se ainda não carregou
                if (!speechSynthesisReady) {
                    forceLoadVoices();
                }
            } catch (error) {
                console.error('Erro ao carregar PDF:', error);
                showError('Erro ao carregar o arquivo PDF. Verifique se o arquivo não está corrompido.');
                loading.classList.add('hidden');
            }
        }

        async function extractAllText() {
            let fullText = '';
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                try {
                    const page = await pdfDoc.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    let pageText = '';
                    let lastY = null;

                    textContent.items.forEach((item, index) => {
                        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                            pageText += '\n';
                        }
                        pageText += item.str;

                        if (index < textContent.items.length - 1) {
                            const nextItem = textContent.items[index + 1];
                            const currentX = item.transform[4] + item.width;
                            const nextX = nextItem.transform[4];
                            if (nextX - currentX > 1) {
                                pageText += ' ';
                            }
                        }
                        lastY = item.transform[5];
                    });

                    fullText += pageText + '\n\n';
                } catch (error) {
                    console.error(`Erro ao extrair texto da página ${pageNum}:`, error);
                    fullText += `[Erro ao extrair texto da página ${pageNum}]\n\n`;
                }
            }
            formatAndDisplayText(fullText);
        }

        function formatAndDisplayText(text) {
            const formattedText = text
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2')
                .replace(/\n([a-z])/g, ' $1')
                .trim();

            extractedText = formattedText;
            const paragraphs = formattedText.split(/\n\s*\n/);
            let htmlContent = '';

            paragraphs.forEach(paragraph => {
                paragraph = paragraph.trim();
                if (paragraph) {
                    if (paragraph.length < 100 && 
                        (paragraph === paragraph.toUpperCase() || /^[A-Z]/.test(paragraph))) {
                        htmlContent += `<h2>${paragraph}</h2>`;
                    } else {
                        htmlContent += `<p>${paragraph}</p>`;
                    }
                }
            });

            readerContent.innerHTML = htmlContent || '<p>Não foi possível extrair texto legível deste PDF.</p>';
            updateDebugInfo();
        }

        // Funções de controle de fonte
        function increaseFontSize() {
            if (fontSize < 32) {
                fontSize += 2;
                updateFontSize();
            }
        }

        function decreaseFontSize() {
            if (fontSize > 10) {
                fontSize -= 2;
                updateFontSize();
            }
        }

        function resetFontSize() {
            fontSize = 16;
            updateFontSize();
        }

        function updateFontSize() {
            readerContent.style.fontSize = fontSize + 'px';
            fontSizeDisplay.textContent = fontSize + 'px';
            quickFontSize.textContent = fontSize + 'px';
        }

        function changeFontFamily() {
            const fontFamily = document.getElementById('fontFamilySelect').value;
            readerContent.style.fontFamily = fontFamily;
        }

        // Funções de fullscreen
        function toggleFullscreen() {
            markUserInteraction();
            if (!document.fullscreenElement) {
                enterFullscreen();
            } else {
                exitFullscreen();
            }
        }

        function enterFullscreen() {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Erro ao entrar em tela cheia:', err);
            });
        }

        function exitFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        function handleFullscreenChange() {
            isFullscreenMode = !!document.fullscreenElement;
            
            if (isFullscreenMode) {
                // Entrou em fullscreen
                document.body.classList.add('fullscreen-mode');
                header.classList.add('fullscreen-hidden');
                mainContent.classList.add('fullscreen');
                readerContainer.classList.add('fullscreen');
                readerContent.classList.add('fullscreen');
                pageInfo.classList.add('fullscreen');
                fullscreenBtn.innerHTML = '🔲 Sair';
                
                // Mostrar controles flutuantes
                floatingControls.classList.add('show');
                
                // Esconder controles após 3 segundos
                setTimeout(() => {
                    if (!quickPanelOpen) {
                        floatingControls.classList.remove('show');
                    }
                }, 3000);
                
            } else {
                // Saiu do fullscreen
                document.body.classList.remove('fullscreen-mode');
                header.classList.remove('fullscreen-hidden');
                mainContent.classList.remove('fullscreen');
                readerContainer.classList.remove('fullscreen');
                readerContent.classList.remove('fullscreen');
                pageInfo.classList.remove('fullscreen');
                fullscreenBtn.innerHTML = '🔳 Tela Cheia';
                
                // Esconder controles flutuantes
                floatingControls.classList.remove('show');
                quickPanel.classList.remove('show');
                quickPanelOpen = false;
            }
            
            updateDebugInfo();
        }

        // Funções TTS melhoradas
        function toggleTTSControls() {
            ttsControls.classList.toggle('hidden');
        }

        function ensureSpeechSynthesisReady() {
            return new Promise((resolve) => {
                if ((speechSynthesisReady && availableVoices.length > 0) || availableVoices.length === 0) {
                    resolve(true);
                    return;
                }
                
                // Tentar carregar vozes novamente
                forceLoadVoices();
                
                // Aguardar um pouco e tentar novamente
                setTimeout(() => {
                    resolve(true); // Permitir mesmo sem vozes específicas
                }, 1000);
            });
        }

        async function startReading(text) {
            markUserInteraction();
            
            if (!('speechSynthesis' in window)) {
                showError('Seu navegador não suporta síntese de voz.');
                return;
            }

            if (!userInteracted) {
    if (isMobileDevice()) {
        showError('Toque na tela ou clique em "Testar Voz" antes de iniciar a leitura no celular.');
    } else {
        showError('Clique na tela antes de iniciar a leitura.');
    }
    return;
}

            const textToRead = text || selectedText || extractedText;
            if (!textToRead) {
                showError('Nenhum texto disponível para leitura.');
                return;
            }

            // Garantir que o speech synthesis está pronto
            await ensureSpeechSynthesisReady();

            // Parar qualquer reprodução anterior
            stopReading();

            try {
                currentUtterance = new SpeechSynthesisUtterance(textToRead);
                
                // Configurar voz se disponível
                if (ttsSettings.voice && availableVoices.length > 0) {
                    const selectedVoice = availableVoices.find(voice => voice.name === ttsSettings.voice);
                    if (selectedVoice) {
                        currentUtterance.voice = selectedVoice;
                        console.log('Using voice:', selectedVoice.name);
                    }
                }

                currentUtterance.rate = ttsSettings.rate;
                currentUtterance.pitch = ttsSettings.pitch;
                currentUtterance.volume = ttsSettings.volume;

                currentUtterance.onstart = () => {
                    console.log('Speech started');
                    isReading = true;
                    isPaused = false;
                    updatePlayPauseButton();
                    updateStatusIndicator('reading');
                    updateDebugInfo();
                };

                currentUtterance.onend = () => {
                    console.log('Speech ended');
                    isReading = false;
                    isPaused = false;
                    updatePlayPauseButton();
                    updateStatusIndicator('stopped');
                    updateDebugInfo();
                };

                currentUtterance.onerror = (event) => {
                    console.error('Speech error:', event);
                    showError(`Erro na síntese de voz: ${event.error}`);
                    isReading = false;
                    isPaused = false;
                    updatePlayPauseButton();
                    updateStatusIndicator('stopped');
                    updateDebugInfo();
                };

                currentUtterance.onpause = () => {
                    console.log('Speech paused');
                    isPaused = true;
                    updatePlayPauseButton();
                    updateStatusIndicator('paused');
                    updateDebugInfo();
                };

                currentUtterance.onresume = () => {
                    console.log('Speech resumed');
                    isPaused = false;
                    updatePlayPauseButton();
                    updateStatusIndicator('reading');
                    updateDebugInfo();
                };

                console.log('Starting speech synthesis...');
                speechSynthesis.speak(currentUtterance);
                
                // Verificar se realmente começou
                setTimeout(() => {
                    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
                        console.error('Speech synthesis failed to start');
                        showError('Falha ao iniciar a síntese de voz. Tente recarregar as vozes.');
                        isReading = false;
                        updatePlayPauseButton();
                        updateStatusIndicator('stopped');
                    }
                    updateDebugInfo();
                }, 100);
                
            } catch (error) {
                console.error('Error starting speech:', error);
                showError('Erro ao iniciar a reprodução de áudio.');
                isReading = false;
                updatePlayPauseButton();
                updateStatusIndicator('stopped');
                updateDebugInfo();
            }
        }

        function pauseReading() {
            if (speechSynthesis.speaking && !speechSynthesis.paused) {
                speechSynthesis.pause();
                // O evento onpause vai atualizar o estado
            }
        }

        function resumeReading() {
            if (speechSynthesis.paused) {
                speechSynthesis.resume();
                // O evento onresume vai atualizar o estado
            }
        }

        function stopReading() {
            speechSynthesis.cancel();
            isReading = false;
            isPaused = false;
            updatePlayPauseButton();
            updateStatusIndicator('stopped');
            updateDebugInfo();
        }

        function toggleReading() {
            markUserInteraction();
            if (isReading) {
                if (isPaused) {
                    resumeReading();
                } else {
                    pauseReading();
                }
            } else {
                startReading();
            }
        }

        // Handlers específicos para controles flutuantes
        function handleFloatingPlayClick() {
            markUserInteraction();
            toggleReading();
        }

        function handleQuickPlayClick() {
            markUserInteraction();
            toggleReading();
        }

        function readSelectedText() {
            if (selectedText) {
                startReading(selectedText);
            }
        }

        function updatePlayPauseButton() {
            const icon = isReading && !isPaused ? '⏸️' : '▶️';
            const text = isReading && !isPaused ? 'Pausar' : 'Reproduzir';
            
            playPauseBtn.innerHTML = `${icon} ${text}`;
            floatingPlayBtn.innerHTML = icon;
            quickPlayIcon.textContent = icon;
            quickPlayText.textContent = text;
        }

        function updateStatusIndicator(status) {
            statusIndicator.className = 'status-indicator';
            switch (status) {
                case 'reading':
                    statusIndicator.classList.add('status-reading');
                    break;
                case 'paused':
                    statusIndicator.classList.add('status-paused');
                    break;
                default:
                    statusIndicator.classList.add('status-stopped');
            }
        }

        // Quick Panel Functions
        function toggleQuickPanel() {
            quickPanelOpen = !quickPanelOpen;
            quickPanel.classList.toggle('show');
            
            if (quickPanelOpen) {
                floatingControls.classList.add('show');
                syncQuickPanelValues();
            } else if (!isFullscreenMode) {
                floatingControls.classList.remove('show');
            }
        }

        function syncQuickPanelValues() {
            quickFontSize.textContent = fontSize + 'px';
            quickVoiceSelect.value = ttsSettings.voice;
            quickRateSlider.value = ttsSettings.rate;
            quickVolumeSlider.value = ttsSettings.volume;
            quickRateValue.textContent = ttsSettings.rate.toFixed(1);
            quickVolumeValue.textContent = Math.round(ttsSettings.volume * 100) + '%';
        }

        function changeVoiceFromQuick() {
            ttsSettings.voice = quickVoiceSelect.value;
            voiceSelect.value = ttsSettings.voice;
            updateDebugInfo();
        }

        function updateRateFromQuick() {
            ttsSettings.rate = parseFloat(quickRateSlider.value);
            quickRateValue.textContent = ttsSettings.rate.toFixed(1);
            rateSlider.value = ttsSettings.rate;
            rateValue.textContent = ttsSettings.rate.toFixed(1);
        }

        function updateVolumeFromQuick() {
            ttsSettings.volume = parseFloat(quickVolumeSlider.value);
            quickVolumeValue.textContent = Math.round(ttsSettings.volume * 100) + '%';
            volumeSlider.value = ttsSettings.volume;
            volumeValue.textContent = Math.round(ttsSettings.volume * 100) + '%';
        }

        // Configurações TTS
        function changeVoice() {
            ttsSettings.voice = voiceSelect.value;
            quickVoiceSelect.value = ttsSettings.voice;
            updateDebugInfo();
        }

        function updateRate() {
            ttsSettings.rate = parseFloat(rateSlider.value);
            rateValue.textContent = ttsSettings.rate.toFixed(1);
            quickRateSlider.value = ttsSettings.rate;
            quickRateValue.textContent = ttsSettings.rate.toFixed(1);
        }

        function updateVolume() {
            ttsSettings.volume = parseFloat(volumeSlider.value);
            volumeValue.textContent = Math.round(ttsSettings.volume * 100) + '%';
            quickVolumeSlider.value = ttsSettings.volume;
            quickVolumeValue.textContent = Math.round(ttsSettings.volume * 100) + '%';
        }

        // Seleção de texto
        function handleTextSelection() {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            
            if (text && text !== selectedText) {
                selectedText = text;
                selectedTextContent.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
                selectedTextPreview.classList.remove('hidden');
                readSelectionBtn.style.display = 'inline-flex';
            } else if (!text) {
                selectedText = '';
                selectedTextPreview.classList.add('hidden');
                readSelectionBtn.style.display = 'none';
            }
            updateDebugInfo();
        }

        // Outras funções
        function updateReadingProgress() {
            const container = readerContainer;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight - container.clientHeight;
            const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            readingProgress.style.width = Math.min(100, Math.max(0, progress)) + '%';
        }

        function toggleTheme() {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            body.setAttribute('data-theme', newTheme);
            const icon = newTheme === 'dark' ? '☀️' : '🌙';
            themeToggle.textContent = icon;
            quickThemeIcon.textContent = icon;
        }

        function handleKeyboardShortcuts(event) {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case '=':
                    case '+':
                        event.preventDefault();
                        increaseFontSize();
                        break;
                    case '-':
                        event.preventDefault();
                        decreaseFontSize();
                        break;
                    case '0':
                        event.preventDefault();
                        resetFontSize();
                        break;
                    case ' ':
                        event.preventDefault();
                        toggleReading();
                        break;
                }
            }

            if (event.key === 'F11') {
                event.preventDefault();
                toggleFullscreen();
            }

            if (event.key === 'Escape' && isFullscreenMode) {
                if (quickPanelOpen) {
                    toggleQuickPanel();
                } else {
                    exitFullscreen();
                }
            }
        }

        function showError(message) {
            const existingError = document.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }

            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);

            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }

        function showSuccess(message) {
            const existingSuccess = document.querySelector('.success-message');
            if (existingSuccess) {
                existingSuccess.remove();
            }

            const successDiv = document.createElement('div');
            successDiv.className = 'error-message';
            successDiv.style.background = 'var(--success-bg)';
            successDiv.textContent = message;
            document.body.appendChild(successDiv);

            setTimeout(() => {
                successDiv.remove();
            }, 3000);
        }

        // Remover classe dragover quando sair da área
        uploadArea.addEventListener('dragleave', (event) => {
            if (!uploadArea.contains(event.relatedTarget)) {
                uploadArea.classList.remove('dragover');
            }
        });

        // Fechar quick panel ao clicar fora
        document.addEventListener('click', (event) => {
            if (quickPanelOpen && !quickPanel.contains(event.target) && !floatingControls.contains(event.target)) {
                toggleQuickPanel();
            }
        });

        // Inicialização
        updateStatusIndicator('stopped');
        updatePlayPauseButton();
        syncQuickPanelValues();

        // Auto-hide floating controls in fullscreen
        let hideControlsTimeout;
        
        function showFloatingControls() {
            if (isFullscreenMode) {
                floatingControls.classList.add('show');
                clearTimeout(hideControlsTimeout);
                
                if (!quickPanelOpen) {
                    hideControlsTimeout = setTimeout(() => {
                        floatingControls.classList.remove('show');
                    }, 3000);
                }
            }
        }

        // Show controls on mouse movement in fullscreen
        document.addEventListener('mousemove', showFloatingControls);
        document.addEventListener('touchstart', showFloatingControls);

        // Verificação periódica do estado do speech synthesis
        setInterval(() => {
            if (isReading && !speechSynthesis.speaking && !speechSynthesis.pending) {
                console.log('Speech synthesis stopped unexpectedly');
                isReading = false;
                isPaused = false;
                updatePlayPauseButton();
                updateStatusIndicator('stopped');
                updateDebugInfo();
            }
        }, 1000);

        // Prevenção de sleep em dispositivos móveis durante reprodução
        let wakeLock = null;

        async function requestWakeLock() {
            if ('wakeLock' in navigator && isReading) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake lock acquired');
                } catch (err) {
                    console.log('Wake lock failed:', err);
                }
            }
        }

        function releaseWakeLock() {
            if (wakeLock) {
                wakeLock.release();
                wakeLock = null;
                console.log('Wake lock released');
            }
        }

        // Aplicar wake lock quando começar a ler
        const originalStartReading = startReading;
        startReading = async function(text) {
            await originalStartReading.call(this, text);
            if (isReading) {
                requestWakeLock();
            }
        };

        // Liberar wake lock quando parar
        const originalStopReading = stopReading;
        stopReading = function() {
            originalStopReading.call(this);
            releaseWakeLock();
        };

        // Liberar wake lock quando a página for escondida
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                releaseWakeLock();
            } else if (isReading) {
                requestWakeLock();
            }
        });
    