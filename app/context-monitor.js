/**
 * Context Monitor - 上下文监控器
 * 实时监控SillyTavern上下文变化，提取最新的好友和消息信息，并通知message-app更新
 */

// 避免重复定义
if (typeof window.ContextMonitor === 'undefined') {

class ContextMonitor {
    constructor() {
        this.isRunning = false;
        this.lastContextHash = null;
        this.lastMessageCount = 0;
        this.lastUpdateTime = 0;
        this.updateInterval = 2000; // 2秒检查一次
        this.monitorTimer = null;

        // SillyTavern相关
        this.eventSource = null;
        this.event_types = null;
        this.chat = null;
        this.characters = null;
        this.this_chid = null;

                // 监控状态
        this.monitoringEnabled = true;
        this.debugMode = false;

        // 流式传输相关
        this.streamingActive = false;
        this.streamingMessageId = null;
        this.streamingStartTime = null;
        this.streamingUpdateInterval = 500; // 流式传输时更频繁检查
        this.streamingTimeoutDuration = 10000; // 10秒超时
        this.streamingTimer = null;
        this.lastStreamingContent = null;

        // 提取器引用
        this.friendRenderer = null;
        this.contextExtractor = null;

        this.init();
    }

    init() {
        console.log('[Context Monitor] 🔍 上下文监控器初始化开始');

        // 延迟启动，确保其他组件已加载
        setTimeout(() => {
            this.setupSillyTavernIntegration();
        }, 500);

        setTimeout(() => {
            this.loadExtractors();
        }, 1000);

        setTimeout(() => {
            this.startMonitoring();
        }, 1500);

        console.log('[Context Monitor] ✅ 上下文监控器初始化完成');
    }

    // 设置SillyTavern集成
    async setupSillyTavernIntegration() {
        console.log('[Context Monitor] 🔗 设置SillyTavern集成...');

        try {
            // 尝试获取SillyTavern的核心模块
            await this.importSillyTavernModules();

            // 设置事件监听器
            this.setupEventListeners();

            console.log('[Context Monitor] ✅ SillyTavern集成设置完成');
        } catch (error) {
            console.error('[Context Monitor] SillyTavern集成设置失败:', error);
        }
    }

    // 导入SillyTavern模块
    async importSillyTavernModules() {
        console.log('[Context Monitor] 📦 导入SillyTavern模块...');

        // 检查全局对象
        this.eventSource = window['eventSource'];
        this.event_types = window['event_types'];
        this.chat = window['chat'];
        this.characters = window['characters'];
        this.this_chid = window['this_chid'];

        if (this.eventSource && this.event_types) {
            console.log('[Context Monitor] ✅ 成功获取SillyTavern事件系统');
        } else {
            console.warn('[Context Monitor] ⚠️ SillyTavern事件系统暂不可用');
        }

        if (this.chat && Array.isArray(this.chat)) {
            console.log('[Context Monitor] ✅ 成功获取聊天数据,', this.chat.length, '条消息');
        } else {
            console.warn('[Context Monitor] ⚠️ 聊天数据暂不可用');
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        if (!this.eventSource || !this.event_types) {
            console.warn('[Context Monitor] 事件系统不可用，跳过事件监听器设置');
            return;
        }

        console.log('[Context Monitor] 🎯 设置事件监听器...');

        // 监听消息接收事件
        this.eventSource.on(this.event_types.MESSAGE_RECEIVED, (messageId) => {
            this.handleContextChange('message_received', messageId);
        });

        // 监听消息发送事件
        this.eventSource.on(this.event_types.MESSAGE_SENT, (messageId) => {
            this.handleContextChange('message_sent', messageId);
        });

        // 监听聊天切换事件
        this.eventSource.on(this.event_types.CHAT_CHANGED, (chatId) => {
            this.handleContextChange('chat_changed', chatId);
        });

        // 监听消息渲染事件
        this.eventSource.on(this.event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            this.handleContextChange('character_rendered', messageId);
        });

        this.eventSource.on(this.event_types.USER_MESSAGE_RENDERED, (messageId) => {
            this.handleContextChange('user_rendered', messageId);
        });

        // 监听消息编辑和删除事件
        this.eventSource.on(this.event_types.MESSAGE_EDITED, (messageId) => {
            this.handleContextChange('message_edited', messageId);
        });

        this.eventSource.on(this.event_types.MESSAGE_DELETED, (messageId) => {
            this.handleContextChange('message_deleted', messageId);
        });

        // 监听流式传输相关事件
        if (this.event_types.GENERATION_STARTED) {
            this.eventSource.on(this.event_types.GENERATION_STARTED, (messageId) => {
                this.handleStreamingStart(messageId);
            });
        }

        if (this.event_types.GENERATION_STOPPED) {
            this.eventSource.on(this.event_types.GENERATION_STOPPED, (messageId) => {
                this.handleStreamingStop(messageId);
            });
        }

        if (this.event_types.GENERATION_PROGRESS) {
            this.eventSource.on(this.event_types.GENERATION_PROGRESS, (messageId) => {
                this.handleStreamingProgress(messageId);
            });
        }

        // 监听更多可能的流式传输事件
        const streamingEventTypes = [
            'STREAM_STARTED',
            'STREAM_PROGRESS',
            'STREAM_STOPPED',
            'STREAM_TOKEN_RECEIVED',
            'GENERATION_CHUNK_RECEIVED',
            'MESSAGE_STREAMING',
            'CHARACTER_MESSAGE_STREAMING'
        ];

        streamingEventTypes.forEach(eventType => {
            if (this.event_types[eventType]) {
                this.eventSource.on(this.event_types[eventType], (messageId) => {
                    this.handleStreamingEvent(eventType, messageId);
                });
            }
        });

        console.log('[Context Monitor] ✅ 事件监听器设置完成');
    }

    // 加载提取器
    loadExtractors() {
        console.log('[Context Monitor] 🔧 加载提取器...');

        // 加载好友渲染器
        if (window.friendRenderer) {
            this.friendRenderer = window.friendRenderer;
            console.log('[Context Monitor] ✅ 好友渲染器已加载');
        } else {
            console.log('[Context Monitor] ⏳ 好友渲染器暂不可用');
        }

        // 加载上下文提取器
        if (window.contextExtractor) {
            this.contextExtractor = window.contextExtractor;
            console.log('[Context Monitor] ✅ 上下文提取器已加载');
        } else {
            console.log('[Context Monitor] ⏳ 上下文提取器暂不可用');
        }
    }

    // 开始监控
    startMonitoring() {
        if (this.isRunning) {
            console.log('[Context Monitor] 监控已在运行');
            return;
        }

        console.log('[Context Monitor] 🚀 开始监控上下文变化...');

        this.isRunning = true;
        this.lastUpdateTime = Date.now();

        // 设置定时检查
        this.monitorTimer = setInterval(() => {
            this.checkContextChanges();
        }, this.updateInterval);

        // 立即执行一次检查
        setTimeout(() => {
            this.checkContextChanges();
        }, 100);

        console.log('[Context Monitor] ✅ 监控已启动');
    }

    // 停止监控
    stopMonitoring() {
        if (!this.isRunning) {
            console.log('[Context Monitor] 监控未在运行');
            return;
        }

        console.log('[Context Monitor] 🛑 停止监控...');

        this.isRunning = false;

        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }

        console.log('[Context Monitor] ✅ 监控已停止');
    }

    // 检查上下文变化
    checkContextChanges() {
        if (!this.monitoringEnabled) {
            return;
        }

        try {
            // 更新SillyTavern引用
            this.updateSillyTavernReferences();

            // 获取当前上下文
            const currentContext = this.getCurrentContext();
            if (!currentContext) {
                if (this.debugMode) {
                    console.log('[Context Monitor] 当前上下文为空');
                }
                return;
            }

            // 计算上下文哈希
            const currentHash = this.calculateContextHash(currentContext);

            // 检查是否有变化
            if (currentHash !== this.lastContextHash) {
                console.log('[Context Monitor] 🔄 检测到上下文变化');

                if (this.debugMode) {
                    console.log('[Context Monitor] 上下文变化详情:', {
                        oldHash: this.lastContextHash,
                        newHash: currentHash,
                        messageCount: currentContext.messageCount,
                        friendCount: currentContext.friendCount
                    });
                }

                // 处理变化
                this.handleContextChange('context_changed', currentContext);

                // 更新记录
                this.lastContextHash = currentHash;
                this.lastMessageCount = currentContext.messageCount;
                this.lastUpdateTime = Date.now();
            }

        } catch (error) {
            console.error('[Context Monitor] 检查上下文变化失败:', error);
        }
    }

    // 更新SillyTavern引用
    updateSillyTavernReferences() {
        // 定期更新引用，防止对象过期
        if (!this.chat || !Array.isArray(this.chat)) {
            this.chat = window['chat'];
        }

        if (!this.characters) {
            this.characters = window['characters'];
        }

        if (this.this_chid === null || this.this_chid === undefined) {
            this.this_chid = window['this_chid'];
        }

        if (!this.eventSource) {
            this.eventSource = window['eventSource'];
        }

        if (!this.event_types) {
            this.event_types = window['event_types'];
        }
    }

    // 获取当前上下文
    getCurrentContext() {
        try {
            // 获取聊天消息
            const messages = this.chat && Array.isArray(this.chat) ? this.chat : [];

            // 获取好友信息
            let friends = [];
            if (this.friendRenderer && typeof this.friendRenderer.extractFriendsFromContext === 'function') {
                try {
                    friends = this.friendRenderer.extractFriendsFromContext();
                } catch (error) {
                    console.warn('[Context Monitor] 提取好友信息失败:', error);
                }
            }

            // 获取当前角色信息
            let currentCharacter = null;
            if (this.characters && this.this_chid !== null && this.this_chid !== undefined) {
                currentCharacter = this.characters[this.this_chid];
            }

            return {
                messages: messages,
                messageCount: messages.length,
                friends: friends,
                friendCount: friends.length,
                currentCharacter: currentCharacter,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[Context Monitor] 获取当前上下文失败:', error);
            return null;
        }
    }

    // 计算上下文哈希
    calculateContextHash(context) {
        try {
            const hashData = {
                messageCount: context.messageCount,
                friendCount: context.friendCount,
                lastMessageId: context.messages.length > 0 ?
                    (context.messages[context.messages.length - 1].send_date ||
                     context.messages[context.messages.length - 1].id ||
                     context.messages.length - 1) : null,
                characterId: context.currentCharacter ? context.currentCharacter.id : null,
                friendsHash: this.hashArray(context.friends.map(f => f.id + f.name))
            };

            return JSON.stringify(hashData);
        } catch (error) {
            console.error('[Context Monitor] 计算上下文哈希失败:', error);
            return Date.now().toString();
        }
    }

    // 简单数组哈希
    hashArray(arr) {
        return arr.join('|');
    }

        // 处理上下文变化
    handleContextChange(eventType, eventData) {
        console.log('[Context Monitor] 📢 处理上下文变化:', eventType, eventData);

        // 如果是流式传输期间，使用不同的处理逻辑
        if (this.streamingActive) {
            this.handleStreamingContextChange(eventType, eventData);
            return;
        }

        // 防抖处理，避免频繁更新
        const now = Date.now();
        if (now - this.lastUpdateTime < 500) {
            if (this.debugMode) {
                console.log('[Context Monitor] 防抖跳过更新');
            }
            return;
        }

        this.lastUpdateTime = now;

        // 更新提取器
        this.updateExtractors();

        // 通知message-app更新
        this.notifyMessageApp(eventType, eventData);

        // 触发全局事件
        this.dispatchContextChangeEvent(eventType, eventData);
    }

    // 处理流式传输开始
    handleStreamingStart(messageId) {
        console.log('[Context Monitor] 🌊 流式传输开始:', messageId);

        this.streamingActive = true;
        this.streamingMessageId = messageId;
        this.streamingStartTime = Date.now();
        this.lastStreamingContent = null;

        // 开始流式传输监控
        this.startStreamingMonitor();

        // 通知开始流式传输
        this.notifyMessageApp('streaming_started', messageId);
    }

    // 处理流式传输停止
    handleStreamingStop(messageId) {
        console.log('[Context Monitor] 🏁 流式传输停止:', messageId);

        this.streamingActive = false;
        this.streamingMessageId = null;
        this.streamingStartTime = null;

        // 停止流式传输监控
        this.stopStreamingMonitor();

        // 最后一次更新
        this.updateExtractors();
        this.notifyMessageApp('streaming_stopped', messageId);

        // 重置到正常监控间隔
        this.resetMonitoringInterval();
    }

    // 处理流式传输进度
    handleStreamingProgress(messageId) {
        if (this.debugMode) {
            console.log('[Context Monitor] 📊 流式传输进度:', messageId);
        }

        // 更新流式传输时间
        if (this.streamingActive && this.streamingMessageId === messageId) {
            this.checkStreamingContent();
        }
    }

    // 处理流式传输事件
    handleStreamingEvent(eventType, messageId) {
        if (this.debugMode) {
            console.log('[Context Monitor] 🌊 流式传输事件:', eventType, messageId);
        }

        // 根据事件类型处理
        if (eventType.includes('STARTED') || eventType.includes('START')) {
            this.handleStreamingStart(messageId);
        } else if (eventType.includes('STOPPED') || eventType.includes('STOP')) {
            this.handleStreamingStop(messageId);
        } else if (eventType.includes('PROGRESS') || eventType.includes('RECEIVED') || eventType.includes('STREAMING')) {
            this.handleStreamingProgress(messageId);
        }
    }

    // 处理流式传输期间的上下文变化
    handleStreamingContextChange(eventType, eventData) {
        if (this.debugMode) {
            console.log('[Context Monitor] 🌊 流式传输期间的上下文变化:', eventType);
        }

        // 在流式传输期间，减少更新频率但不完全停止
        const now = Date.now();
        if (now - this.lastUpdateTime < 200) { // 流式传输期间减少到200ms
            return;
        }

        this.lastUpdateTime = now;

        // 只进行轻量级更新
        this.checkStreamingContent();
        this.notifyMessageApp(eventType, eventData);
    }

    // 开始流式传输监控
    startStreamingMonitor() {
        console.log('[Context Monitor] 🚀 开始流式传输监控');

        // 清除现有定时器
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
        }

        // 设置流式传输监控定时器
        this.streamingTimer = setInterval(() => {
            this.checkStreamingContent();
        }, this.streamingUpdateInterval);

        // 设置超时检查
        setTimeout(() => {
            if (this.streamingActive) {
                console.warn('[Context Monitor] 流式传输超时，强制停止监控');
                this.handleStreamingStop(this.streamingMessageId);
            }
        }, this.streamingTimeoutDuration);
    }

    // 停止流式传输监控
    stopStreamingMonitor() {
        console.log('[Context Monitor] 🛑 停止流式传输监控');

        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }
    }

    // 检查流式传输内容
    checkStreamingContent() {
        if (!this.streamingActive || !this.streamingMessageId) {
            return;
        }

        try {
            // 获取当前上下文
            const currentContext = this.getCurrentContext();
            if (!currentContext || !currentContext.messages) {
                return;
            }

            // 查找流式传输的消息
            const streamingMessage = currentContext.messages.find(msg =>
                msg.id === this.streamingMessageId ||
                msg.send_date === this.streamingMessageId ||
                currentContext.messages.indexOf(msg) == this.streamingMessageId
            ) || currentContext.messages[currentContext.messages.length - 1];

            if (!streamingMessage) {
                return;
            }

            // 检查内容是否有变化
            const currentContent = streamingMessage.mes || '';
            if (currentContent !== this.lastStreamingContent) {
                this.lastStreamingContent = currentContent;

                if (this.debugMode) {
                    console.log('[Context Monitor] 🔄 检测到流式传输内容变化，长度:', currentContent.length);
                }

                // 更新提取器
                this.updateExtractors();

                // 通知message-app
                this.notifyMessageApp('streaming_content_updated', {
                    messageId: this.streamingMessageId,
                    content: currentContent,
                    contentLength: currentContent.length
                });
            }

        } catch (error) {
            console.error('[Context Monitor] 检查流式传输内容失败:', error);
        }
    }

    // 重置监控间隔
    resetMonitoringInterval() {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = setInterval(() => {
                this.checkContextChanges();
            }, this.updateInterval);
        }
    }

    // 更新提取器
    updateExtractors() {
        console.log('[Context Monitor] 🔄 更新提取器...');

        try {
            // 更新好友渲染器
            if (this.friendRenderer && typeof this.friendRenderer.refresh === 'function') {
                this.friendRenderer.refresh();
                console.log('[Context Monitor] ✅ 好友渲染器已更新');
            }

            // 更新上下文提取器
            if (this.contextExtractor && typeof this.contextExtractor.refresh === 'function') {
                this.contextExtractor.refresh();
                console.log('[Context Monitor] ✅ 上下文提取器已更新');
            }

        } catch (error) {
            console.error('[Context Monitor] 更新提取器失败:', error);
        }
    }

    // 通知message-app更新
    notifyMessageApp(eventType, eventData) {
        console.log('[Context Monitor] 📱 通知message-app更新...');

        try {
            // 检查message-app是否存在
            if (!window.messageApp) {
                console.log('[Context Monitor] message-app不存在，跳过通知');
                return;
            }

            // 获取最新数据
            const latestContext = this.getCurrentContext();

            // 通知message-app进行增量更新
            if (typeof window.messageApp.handleContextUpdate === 'function') {
                window.messageApp.handleContextUpdate(eventType, eventData, latestContext);
                console.log('[Context Monitor] ✅ 已通知message-app进行增量更新');
            } else {
                // 如果没有增量更新方法，尝试触发自动渲染
                if (typeof window.messageApp.triggerAutoRender === 'function') {
                    window.messageApp.triggerAutoRender();
                    console.log('[Context Monitor] ✅ 已触发message-app自动渲染');
                }
            }

        } catch (error) {
            console.error('[Context Monitor] 通知message-app失败:', error);
        }
    }

    // 触发全局上下文变化事件
    dispatchContextChangeEvent(eventType, eventData) {
        try {
            const event = new CustomEvent('contextMonitorChange', {
                detail: {
                    eventType: eventType,
                    eventData: eventData,
                    timestamp: Date.now(),
                    context: this.getCurrentContext()
                }
            });

            window.dispatchEvent(event);

            if (this.debugMode) {
                console.log('[Context Monitor] 📡 已触发全局上下文变化事件');
            }

        } catch (error) {
            console.error('[Context Monitor] 触发全局事件失败:', error);
        }
    }

    // 获取监控状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            monitoringEnabled: this.monitoringEnabled,
            lastUpdateTime: this.lastUpdateTime,
            lastContextHash: this.lastContextHash,
            lastMessageCount: this.lastMessageCount,
            updateInterval: this.updateInterval,
            debugMode: this.debugMode,
            hasSillyTavernIntegration: !!(this.eventSource && this.event_types),
            hasFriendRenderer: !!this.friendRenderer,
            hasContextExtractor: !!this.contextExtractor
        };
    }

    // 设置监控间隔
    setUpdateInterval(interval) {
        this.updateInterval = Math.max(500, interval); // 最小500ms
        console.log('[Context Monitor] 更新间隔设置为:', this.updateInterval, 'ms');

        if (this.isRunning) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    // 启用/禁用监控
    setMonitoringEnabled(enabled) {
        this.monitoringEnabled = enabled;
        console.log('[Context Monitor] 监控', enabled ? '启用' : '禁用');
    }

    // 启用/禁用调试模式
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log('[Context Monitor] 调试模式', enabled ? '启用' : '禁用');
    }

    // 手动触发更新
    forceUpdate() {
        console.log('[Context Monitor] 🔄 手动触发更新...');
        this.lastContextHash = null; // 强制触发更新
        this.checkContextChanges();
    }

    // 重启监控
    restart() {
        console.log('[Context Monitor] 🔄 重启监控...');
        this.stopMonitoring();

        setTimeout(() => {
            this.setupSillyTavernIntegration();
            this.loadExtractors();
            this.startMonitoring();
        }, 1000);
    }
}

// 创建全局实例
window.ContextMonitor = ContextMonitor;

// 自动创建实例
if (!window.contextMonitor) {
    window.contextMonitor = new ContextMonitor();
}

console.log('[Context Monitor] 📦 上下文监控器模块加载完成');

} // 结束 if (typeof window.ContextMonitor === 'undefined') 检查
