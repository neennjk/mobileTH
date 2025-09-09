// ==Mobile Context Editor==
// @name         Mobile Context Editor
// @version      2.0.0
// @description  SillyTavern移动端上下文编辑器 - 使用原生API
// @author       cd
// @license      MIT

/**
 * SillyTavern 移动端上下文编辑器 v2.1
 * 使用SillyTavern.getContext() API和数据结构
 */
class MobileContextEditor {
  constructor() {
    this.initialized = false;
    this.currentChatData = null;
    this.isModified = false;
    this.log('info', 'MobileContextEditor 初始化开始');

    // 立即初始化
    this.initialize();
  }

  /**
   * 等待SillyTavern完全加载 - 监听APP_READY事件
   */
  async waitForSillyTavern() {
    // 检查是否已经有APP_READY事件
    if (window.eventSource && window.event_types) {
      console.log('[Mobile Context Editor] 监听APP_READY事件...');
      window.eventSource.on(window.event_types.APP_READY, () => {
        console.log('[Mobile Context Editor] ✅ APP_READY事件触发，开始初始化');
        this.initialize();
      });
    } else {
      // 备用方案：等待事件系统加载
      const checkInterval = setInterval(() => {
        if (window.eventSource && window.event_types) {
          clearInterval(checkInterval);
          console.log('[Mobile Context Editor] 事件系统已加载，监听APP_READY...');
          window.eventSource.on(window.event_types.APP_READY, () => {
            console.log('[Mobile Context Editor] ✅ APP_READY事件触发，开始初始化');
            this.initialize();
          });
        } else if (this.isSillyTavernReady()) {
          // 如果SillyTavern已经完全加载，直接初始化
          clearInterval(checkInterval);
          console.log('[Mobile Context Editor] ✅ SillyTavern已就绪，直接初始化');
          this.initialize();
        }
      }, 500);
    }
  }

  /**
   * 检查SillyTavern是否准备就绪
   */
  isSillyTavernReady() {
    try {
      // 检查新的SillyTavern API
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        const context = window.SillyTavern.getContext();
        return !!(context && context.chat && Array.isArray(context.chat));
      }

      // 降级检查旧的全局变量
      return !!(window.SillyTavern && window.chat && window.characters && window.this_chid !== undefined);
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化编辑器
   */
  initialize() {
    try {
      this.initialized = true;
      this.setupUI();
      this.bindEvents();
      console.log('[Mobile Context Editor] v2.0 初始化完成 - 使用原生API');
    } catch (error) {
      console.error('[Mobile Context Editor] 初始化失败:', error);
    }
  }

  /**
   * 强制初始化 - 即使SillyTavern未完全就绪也创建界面
   */
  forceInitialize() {
    try {
      console.log('[Mobile Context Editor] 🔧 强制初始化编辑器界面');
      this.setupUI();
      this.bindEvents();
      this.showEditor();
      return true;
    } catch (error) {
      console.error('[Mobile Context Editor] 强制初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取当前聊天数据
   */
  getCurrentChatData() {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern 未准备就绪');
      }

      let chatData;

      // 优先使用新的SillyTavern API
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        const context = window.SillyTavern.getContext();
        const currentCharacter = context.characters[context.characterId];

        chatData = {
          header: {
            user_name: context.name1 || 'User',
            character_name: context.name2 || currentCharacter?.name || 'Assistant',
            create_date: context.chatCreateDate || Date.now(),
            chat_metadata: context.chatMetadata || {},
          },
          messages: context.chat, // 直接引用SillyTavern的chat数组
          fileName: currentCharacter?.chat,
          characterName: currentCharacter?.name || 'Assistant',
          userName: context.name1 || 'User',
          avatarUrl: currentCharacter?.avatar,
        };
      } else {
        // 降级使用旧的全局变量
        const character = window.characters[window.this_chid];
        if (!character) {
          throw new Error('未找到当前角色');
        }

        chatData = {
          header: {
            user_name: window.name1 || 'User',
            character_name: window.name2 || character.name,
            create_date: window.chat_create_date || Date.now(),
            chat_metadata: window.chat_metadata || {},
          },
          messages: window.chat,
          fileName: character.chat,
          characterName: character.name,
          userName: window.name1 || 'User',
          avatarUrl: character.avatar,
        };
      }

      this.currentChatData = chatData;
      this.log('info', `加载聊天数据成功: ${chatData.messages.length} 条消息 (${chatData.characterName})`);

      return chatData;
    } catch (error) {
      this.log('error', '获取聊天数据失败', error);
      throw error;
    }
  }

  /**
   * 修改消息内容（使用SillyTavern API）
   */
  async modifyMessage(messageIndex, newContent, newName = null) {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      const context = window.SillyTavern.getContext();
      const chat = context.chat;

      if (messageIndex < 0 || messageIndex >= chat.length) {
        throw new Error(`消息索引无效: ${messageIndex} (总共 ${chat.length} 条消息)`);
      }

      // 修改聊天数组中的消息
      const message = chat[messageIndex];
      const oldContent = message.mes;

      message.mes = newContent;
      if (newName !== null) {
        message.name = newName;
      }

      // 使用SillyTavern上下文API保存和刷新
      await context.saveChat();
    //   await context.reloadCurrentChat(); // 重新加载当前聊天

      this.isModified = true;
      console.log(
        `[Mobile Context Editor] 修改消息 ${messageIndex}: "${oldContent.substring(
          0,
          30,
        )}..." → "${newContent.substring(0, 30)}..."`,
      );

      return true;
    } catch (error) {
      console.error('[Mobile Context Editor] 修改消息失败:', error);
      throw error;
    }
  }

  /**
   * 添加新消息（使用SillyTavern的原生API）
   */
  async addMessage(content, isUser = false, name = null, extra = {}) {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      const context = window.SillyTavern.getContext();

      // 构建消息对象（符合SillyTavern的消息格式）
      const message = {
        name: name || (isUser ? context.name1 || 'User' : context.name2 || 'Assistant'),
        is_user: true,
        is_system: false,
        force_avatar: true,
        mes: content,
        send_date: Date.now(),
        extra: extra,
        ...(!isUser && { gen_started: Date.now(), gen_finished: Date.now() }),
      };

      // 如果不是用户消息，添加生成相关字段
      if (!isUser) {
        message.swipe_id = 0;
        message.swipes = [content];
      }

      // 添加到聊天数组
      context.chat.push(message);

      // 使用SillyTavern上下文API添加消息
      context.addOneMessage(message);

      // 保存聊天
      await context.saveChat();

      this.isModified = true;
      console.log(`[Mobile Context Editor] 添加新${isUser ? '用户' : '助手'}消息: "${content.substring(0, 50)}..."`);

      return context.chat.length - 1; // 返回新消息的索引
    } catch (error) {
      console.error('[Mobile Context Editor] 添加消息失败:', error);
      throw error;
    }
  }

  /**
   * 删除消息 - 改进版本
   */
  async deleteMessage(messageIndex) {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern 未准备就绪');
      }

      let chatArray;

      // 获取聊天数组
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        const context = window.SillyTavern.getContext();
        chatArray = context.chat;
      } else {
        chatArray = window.chat;
      }

      if (!chatArray || !Array.isArray(chatArray)) {
        throw new Error('聊天数据不可用');
      }

      if (messageIndex < 0 || messageIndex >= chatArray.length) {
        throw new Error(`消息索引无效: ${messageIndex}，总消息数: ${chatArray.length}`);
      }

      const messageToDelete = chatArray[messageIndex];
      this.log(
        'info',
        `准备删除消息 ${messageIndex}: ${messageToDelete.name}: ${messageToDelete.mes.substring(0, 50)}...`,
      );

      // 直接从聊天数组中删除
      const deletedMessage = chatArray.splice(messageIndex, 1)[0];
      this.isModified = true;

      this.log('info', `消息 ${messageIndex} 删除成功`);

      // 立即保存和刷新
      await this.saveChatData();
      await this.refreshChatDisplay();

      return deletedMessage;
    } catch (error) {
      this.log('error', '删除消息失败', error);
      throw error;
    }
  }

  /**
   * 保存聊天数据 - 改进版本
   */
  async saveChatData() {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern 未准备就绪');
      }

      this.log('info', '开始保存聊天数据...');

      // 方法1: 使用SillyTavern.getContext().saveChat (新API)
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        try {
          const context = window.SillyTavern.getContext();
          if (context && typeof context.saveChat === 'function') {
            this.log('info', '使用 SillyTavern.getContext().saveChat 保存...');
            await context.saveChat();
            this.log('info', 'SillyTavern.getContext().saveChat 保存成功');
            this.isModified = false;
            return true;
          }
        } catch (error) {
          this.log('warn', 'SillyTavern.getContext().saveChat 失败，尝试其他方法', error);
        }
      }

      // 方法2: 使用SillyTavern的原生保存函数
      if (typeof window.saveChat === 'function') {
        this.log('info', '使用 window.saveChat 保存...');
        await window.saveChat();
        this.log('info', 'window.saveChat 保存成功');
        this.isModified = false;
        return true;
      }

      // 方法3: 使用saveChatConditional
      if (typeof window.saveChatConditional === 'function') {
        this.log('info', '使用 window.saveChatConditional 保存...');
        await window.saveChatConditional();
        this.log('info', 'window.saveChatConditional 保存成功');
        this.isModified = false;
        return true;
      }

      // 方法4: 手动调用API（兼容旧版本）
      let character, chatData, userName, characterName;

      // 获取角色和聊天数据
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        const context = window.SillyTavern.getContext();
        character = context.characters[context.characterId];
        chatData = context.chat;
        userName = context.name1 || 'User';
        characterName = context.name2 || character?.name || 'Assistant';
      } else {
        character = window.characters?.[window.this_chid];
        chatData = window.chat;
        userName = window.name1 || 'User';
        characterName = window.name2 || character?.name || 'Assistant';
      }

      if (character && chatData) {
        this.log('info', '使用手动API调用保存...');

        const saveData = [
          {
            user_name: userName,
            character_name: characterName,
            create_date: window.chat_create_date || Date.now(),
            chat_metadata: window.chat_metadata || {},
          },
          ...chatData,
        ];

        const response = await fetch('/api/chats/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ch_name: character.name,
            file_name: character.chat,
            chat: saveData,
            avatar_url: character.avatar,
          }),
        });

        if (!response.ok) {
          throw new Error(`保存失败: ${response.status} ${response.statusText}`);
        }

        this.log('info', '手动API调用保存成功');
        this.isModified = false;
        return true;
      }

      throw new Error('没有可用的保存方法或角色信息缺失');
    } catch (error) {
      this.log('error', '保存聊天数据失败', error);
      throw error;
    }
  }

  /**
   * 刷新聊天显示
   */
  async refreshChatDisplay() {
    try {
      if (typeof window.printMessages === 'function') {
        this.log('info', '刷新聊天显示...');
        await window.printMessages();
        this.log('info', '聊天显示刷新成功');
      } else {
        this.log('warn', 'printMessages 函数不可用');
      }
    } catch (error) {
      this.log('error', '刷新聊天显示失败', error);
    }
  }

  /**
   * 导出聊天数据为JSONL格式
   */
  exportToJsonl() {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      const context = window.SillyTavern.getContext();

      // 构建JSONL数据（符合SillyTavern格式）
      const header = {
        user_name: context.name1 || 'User',
        character_name: context.name2 || 'Assistant',
        create_date: context.chat_create_date || Date.now(),
        chat_metadata: context.chatMetadata || {},
      };

      const saveData = [header, ...context.chat];
      const jsonlData = saveData.map(JSON.stringify).join('\n');

      // 下载文件
      const blob = new Blob([jsonlData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_edited_${Date.now()}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('[Mobile Context Editor] JSONL 导出完成');
      return jsonlData;
    } catch (error) {
      console.error('[Mobile Context Editor] 导出失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    try {
      if (!this.isSillyTavernReady()) return null;

      const context = window.SillyTavern.getContext();
      const messages = context.chat;
      const userMessages = messages.filter(msg => msg.is_user);
      const botMessages = messages.filter(msg => !msg.is_user);
      const totalCharacters = messages.reduce((sum, msg) => sum + (msg.mes || '').length, 0);

      return {
        totalMessages: messages.length,
        userMessages: userMessages.length,
        botMessages: botMessages.length,
        totalCharacters: totalCharacters,
        averageMessageLength: Math.round(totalCharacters / messages.length),
        characterName: context.characters[context.characterId]?.name || context.name2 || 'Unknown',
        isGroup: !!context.groupId,
        sillyTavernReady: this.isSillyTavernReady(),
      };
    } catch (error) {
      console.error('[Mobile Context Editor] 获取统计失败:', error);
      return null;
    }
  }

  /**
   * 调试SillyTavern状态
   */
  debugSillyTavernStatus() {
    console.log('=== SillyTavern 状态调试 ===');
    console.log('SillyTavern对象:', !!window.SillyTavern);
    console.log('chat数组:', !!window.chat, window.chat?.length);
    console.log('characters数组:', !!window.characters, window.characters?.length);
    console.log('this_chid:', window.this_chid);
    console.log('saveChat函数:', typeof window.saveChat);
    console.log('printMessages函数:', typeof window.printMessages);
    console.log('saveChatConditional函数:', typeof window.saveChatConditional);
    console.log('准备状态:', this.isSillyTavernReady());
  }

  /**
   * 等待SillyTavern准备就绪
   */
  async waitForSillyTavernReady(timeout = 30000) {
    console.log('[Mobile Context Editor] 等待SillyTavern准备就绪...');

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isSillyTavernReady()) {
        console.log('[Mobile Context Editor] ✅ SillyTavern已准备就绪');
        return true;
      }

      // 等待500ms后重试
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.warn('[Mobile Context Editor] ⚠️ 等待超时，SillyTavern可能未完全加载');
    return false;
  }

  /**
   * 设置移动端UI界面
   */
  setupUI() {
    // 等待jQuery加载
    if (typeof $ === 'undefined') {
      setTimeout(() => this.setupUI(), 1000);
      return;
    }

    // 创建移动端编辑器按钮（放在右下角，与其他mobile按钮保持一致）
    const buttonHtml = `
            <button id="mobile-context-editor-btn" style="position: fixed; bottom: 80px; right: 20px; z-index: 9997; background: linear-gradient(135deg, #9C27B0, #673AB7); color: white; border: none; padding: 12px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: all 0.3s ease; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🛠️
            </button>
        `;

    $('body').append(buttonHtml);

    // 悬停效果
    $('#mobile-context-editor-btn').hover(
      function () {
        $(this).css('transform', 'scale(1.1)');
      },
      function () {
        $(this).css('transform', 'scale(1)');
      },
    );

    // 创建移动端优化的编辑器弹窗
    const modalHtml = `
            <div id="mobile-context-editor-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 9999; overflow-y: auto;">

                <div style="background: linear-gradient(135deg, #9C27B0, #673AB7); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                    <h3 style="margin: 0; font-size: 18px;">🛠️ 上下文编辑器 v2.1</h3>
                    <button id="mobile-context-editor-close" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 14px;">✖️ 关闭</button>
                </div>

                <div style="padding: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <button id="mobile-load-chat-btn" style="background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">📂 加载聊天</button>
                        <button id="mobile-save-chat-btn" style="background: #2196F3; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>💾 保存</button>
                        <button id="mobile-add-message-btn" style="background: #FF9800; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>➕ 添加</button>
                        <button id="mobile-stats-btn" style="background: #795548; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>📊 统计</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <button id="mobile-refresh-btn" style="background: #607D8B; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>🔄 刷新</button>
                        <button id="mobile-export-btn" style="background: #E91E63; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>📤 导出</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <button id="mobile-quick-edit-btn" style="background: #9C27B0; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>⚡ 快速修改</button>
                        <button id="mobile-test-api-btn" style="background: #00BCD4; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;" disabled>🔧 测试API</button>
                    </div>

                    <div id="mobile-context-editor-status" style="margin-bottom: 15px; padding: 12px; background: #f5f5f5; border-radius: 8px; color: #333; min-height: 20px; font-size: 14px; border-left: 4px solid #2196F3;"></div>

                    <div id="mobile-context-editor-content" style="border: 1px solid #ddd; border-radius: 8px; background: #fafafa; min-height: 300px; max-height: 400px; overflow-y: auto;">
                        <p style="text-align: center; padding: 40px 20px; color: #666; margin: 0; font-size: 16px;">点击"加载聊天"开始编辑</p>
                    </div>
                </div>
            </div>
        `;

    $('body').append(modalHtml);
  }

  /**
   * 绑定移动端事件
   */
  bindEvents() {
    if (typeof $ === 'undefined') {
      setTimeout(() => this.bindEvents(), 1000);
      return;
    }

    // 打开/关闭编辑器
    $(document).on('click', '#mobile-context-editor-btn', () => this.showEditor());
    $(document).on('click', '#mobile-context-editor-close', () => this.hideEditor());

    // 功能按钮
    $(document).on('click', '#mobile-load-chat-btn', async () => {
      try {
        this.updateStatus('🔄 正在检查SillyTavern状态...');

        // 等待SillyTavern准备就绪
        const isReady = await this.waitForSillyTavernReady(10000);
        if (!isReady) {
          this.updateStatus('❌ SillyTavern未准备就绪，请等待页面完全加载后重试');
          return;
        }

        this.updateStatus('🔄 正在加载聊天数据...');
        const chatData = this.getCurrentChatData();
        this.renderMobileChatMessages();
        this.updateStatus(`✅ 聊天数据加载成功！共 ${chatData.messages.length} 条消息 (${chatData.characterName})`);
        this.updateMobileButtonStates();
      } catch (error) {
        this.updateStatus(`❌ 加载失败: ${error.message}`);
      }
    });

    $(document).on('click', '#mobile-save-chat-btn', async () => {
      try {
        await this.saveChatData();
        this.updateStatus('✅ 保存成功！');
      } catch (error) {
        this.updateStatus(`❌ 保存失败: ${error.message}`);
      }
    });

    $(document).on('click', '#mobile-add-message-btn', async () => {
      const content = prompt('请输入新消息内容:');
      if (content) {
        const isUser = confirm('这是用户消息吗？\n点击"确定"表示用户消息\n点击"取消"表示角色消息');
        try {
          await this.addMessage(content, isUser);
          this.renderMobileChatMessages();
          this.updateStatus(`➕ 已添加新${isUser ? '用户' : '角色'}消息`);
          this.updateMobileButtonStates();
        } catch (error) {
          this.updateStatus(`❌ 添加失败: ${error.message}`);
        }
      }
    });

    $(document).on('click', '#mobile-stats-btn', () => {
      const stats = this.getStatistics();
      if (stats) {
        const statsText = `📊 总计${stats.totalMessages}条 | 用户${stats.userMessages}条 | 角色${stats.botMessages}条 | ${stats.totalCharacters}字符 | ${stats.characterName}`;
        this.updateStatus(statsText);
      }
    });

    $(document).on('click', '#mobile-refresh-btn', async () => {
      try {
        await this.refreshChatDisplay();
        this.renderMobileChatMessages();
        this.updateStatus('🔄 界面刷新完成');
      } catch (error) {
        this.updateStatus(`❌ 刷新失败: ${error.message}`);
      }
    });

    $(document).on('click', '#mobile-export-btn', () => {
      try {
        this.exportToJsonl();
        this.updateStatus('📤 JSONL文件导出成功');
      } catch (error) {
        this.updateStatus(`❌ 导出失败: ${error.message}`);
      }
    });

    $(document).on('click', '#mobile-quick-edit-btn', async () => {
      try {
        this.updateStatus('⚡ 启动快速修改...');
        await this.quickEditLastMessage();
      } catch (error) {
        this.updateStatus(`❌ 快速修改失败: ${error.message}`);
      }
    });

    $(document).on('click', '#mobile-test-api-btn', async () => {
      try {
        this.updateStatus('🔧 测试API连接...');
        await this.testApiConnection();
      } catch (error) {
        this.updateStatus(`❌ API测试失败: ${error.message}`);
      }
    });

    // 消息操作
    $(document).on('click', '.mobile-edit-message-btn', async e => {
      const messageIndex = parseInt($(e.target).data('index'));
      await this.editMobileMessage(messageIndex);
    });

    $(document).on('click', '.mobile-delete-message-btn', async e => {
      if (confirm('确定要删除这条消息吗？')) {
        const messageIndex = parseInt($(e.target).data('index'));
        try {
          await this.deleteMessage(messageIndex);
          this.renderMobileChatMessages();
          this.updateStatus(`🗑️ 已删除消息 ${messageIndex}`);
          this.updateMobileButtonStates();
        } catch (error) {
          this.updateStatus(`❌ 删除失败: ${error.message}`);
        }
      }
    });
  }

  showEditor() {
    // 确保UI已经创建
    if (!$('#mobile-context-editor-modal').length) {
      this.setupUI();
    }

    $('#mobile-context-editor-modal').show();

    // 检查SillyTavern状态并显示相应界面
    if (!this.isSillyTavernReady()) {
      this.showWaitingInterface();
    } else {
      const context = window.SillyTavern.getContext();
      if (context && context.chat && context.chat.length > 0) {
        this.renderMobileChatMessages();
        this.updateStatus('✅ 聊天数据已就绪，可以开始编辑');
      } else {
        this.updateStatus('⚠️ 请先加载聊天数据');
      }
    }

    this.updateMobileButtonStates();
  }

  /**
   * 显示等待SillyTavern加载的界面
   */
  showWaitingInterface() {
    const waitingHtml = `
            <div style="text-align: center; padding: 30px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                <h3 style="margin: 0 0 15px 0; color: #333;">SillyTavern 正在加载...</h3>
                <p style="margin: 0 0 20px 0;">请等待SillyTavern完全加载后再使用编辑功能</p>

                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left;">
                    <strong>📊 加载状态：</strong><br>
                    <div id="waiting-status-details" style="margin-top: 10px; font-family: monospace; font-size: 12px;"></div>
                </div>

                <div style="margin: 20px 0;">
                    <button onclick="window.mobileContextEditor.checkAndRefresh()" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; border: none; padding: 12px 24px; border-radius: 25px;
                        font-size: 16px; cursor: pointer; margin: 5px;
                    ">🔄 重新检查</button>

                    <button onclick="window.mobileContextEditor.forceMode()" style="
                        background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
                        color: white; border: none; padding: 12px 24px; border-radius: 25px;
                        font-size: 16px; cursor: pointer; margin: 5px;
                    ">🛠️ 强制模式</button>
                </div>

                <div style="margin: 20px 0; font-size: 14px; color: #888;">
                    <p>💡 小贴士：首次加载可能需要1-2分钟</p>
                    <p>🔧 如果长时间无法加载，请尝试刷新页面</p>
                </div>
            </div>
        `;

    $('#mobile-context-editor-content').html(waitingHtml);
    this.updateStatus('⏳ 等待SillyTavern加载完成...');
    this.updateWaitingStatus();
  }

  /**
   * 检查并刷新状态
   */
  checkAndRefresh() {
    console.log('[Mobile Context Editor] 重新检查SillyTavern状态...');

    if (this.isSillyTavernReady()) {
      this.updateStatus('✅ SillyTavern已就绪！正在加载聊天数据...');
      this.renderMobileChatMessages();
      this.updateMobileButtonStates();
    } else {
      this.updateWaitingStatus();
      this.updateStatus('⏳ SillyTavern仍在加载中，请稍候...');
    }
  }

  /**
   * 更新等待状态的详细信息
   */
  updateWaitingStatus() {
    const statusDetails = document.getElementById('waiting-status-details');
    if (statusDetails) {
      const status = this.debugSillyTavernStatus();
      const details = [
        `聊天数据 (window.chat): ${status.chatLoaded ? '✅ 已加载' : '❌ 未加载'}`,
        `角色数据 (window.characters): ${status.charactersLoaded ? '✅ 已加载' : '❌ 未加载'}`,
        `当前角色 (window.this_chid): ${status.currentCharacter ? '✅ 已选择' : '❌ 未选择'}`,
        `保存函数 (saveChatConditional): ${status.saveFunctionAvailable ? '✅ 可用' : '❌ 不可用'}`,
        `渲染函数 (printMessages): ${status.renderFunctionAvailable ? '✅ 可用' : '❌ 不可用'}`,
      ];
      statusDetails.innerHTML = details.join('<br>');
    }
  }

  /**
   * 强制模式 - 提供基本功能即使SillyTavern未完全就绪
   */
  forceMode() {
    const forceHtml = `
            <div style="padding: 20px; color: #333;">
                <h3 style="margin: 0 0 15px 0; color: #FF6B6B;">🛠️ 强制模式</h3>
                <p style="margin: 0 0 15px 0;">SillyTavern仍在加载中，但您可以使用以下功能：</p>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <strong>⚠️ 注意：</strong> 在此模式下，某些功能可能无法正常工作。建议等待完全加载后使用。
                </div>

                <div style="background: #e7f3ff; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <strong>📝 可用的控制台命令：</strong><br>
                    <code style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: block; margin: 8px 0; font-family: monospace;">
                        MobileContext.debugSillyTavernStatus() // 检查状态<br>
                        MobileContext.smartLoadChat() // 智能加载<br>
                        MobileContext.showContextEditor() // 重新打开编辑器
                    </code>
                </div>

                <div style="background: #d1ecf1; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <strong>🔄 自动重试：</strong><br>
                    编辑器会每30秒自动检查一次SillyTavern状态。
                </div>

                <div style="margin: 20px 0;">
                    <button onclick="window.mobileContextEditor.checkAndRefresh()" style="
                        background: #007bff; color: white; border: none; padding: 10px 20px;
                        border-radius: 20px; cursor: pointer; margin: 5px;
                    ">🔄 立即重试</button>

                    <button onclick="window.mobileContextEditor.hideEditor()" style="
                        background: #6c757d; color: white; border: none; padding: 10px 20px;
                        border-radius: 20px; cursor: pointer; margin: 5px;
                    ">❌ 关闭编辑器</button>
                </div>
            </div>
        `;

    $('#mobile-context-editor-content').html(forceHtml);
    this.updateStatus('🛠️ 强制模式已激活 - 请使用控制台命令');

    // 开始自动重试
    this.startAutoRetry();
  }

  /**
   * 开始自动重试检查
   */
  startAutoRetry() {
    if (this.autoRetryInterval) {
      clearInterval(this.autoRetryInterval);
    }

    this.autoRetryInterval = setInterval(() => {
      if (this.isSillyTavernReady()) {
        console.log('[Mobile Context Editor] 自动重试成功，SillyTavern已就绪！');
        clearInterval(this.autoRetryInterval);
        this.checkAndRefresh();
      } else {
        console.log('[Mobile Context Editor] 自动重试检查中...');
      }
    }, 30000); // 每30秒检查一次
  }

  hideEditor() {
    $('#mobile-context-editor-modal').hide();
  }

  updateStatus(message) {
    $('#mobile-context-editor-status').html(message);
  }

  updateMobileButtonStates() {
    let hasData = false;
    if (this.isSillyTavernReady()) {
      const context = window.SillyTavern.getContext();
      hasData = context && context.chat && context.chat.length > 0;
    }

    $('#mobile-save-chat-btn').prop('disabled', !hasData);
    $('#mobile-add-message-btn').prop('disabled', !hasData);
    $('#mobile-stats-btn').prop('disabled', !hasData);
    $('#mobile-refresh-btn').prop('disabled', !hasData);
    $('#mobile-export-btn').prop('disabled', !hasData);
    $('#mobile-quick-edit-btn').prop('disabled', !hasData);
    $('#mobile-test-api-btn').prop('disabled', !this.isSillyTavernReady()); // API测试只需要SillyTavern就绪
  }

  renderMobileChatMessages() {
    if (!this.isSillyTavernReady()) return;

    const context = window.SillyTavern.getContext();
    if (!context.chat || !context.chat.length) return;

    const messages = context.chat;
    let html = '<div style="padding: 10px;">';

    messages.forEach((message, index) => {
      const isUser = message.is_user;
      const name = message.name || (isUser ? '用户' : '助手');
      const content = (message.mes || '').substring(0, 150) + (message.mes && message.mes.length > 150 ? '...' : '');

      html += `
                <div style="margin-bottom: 15px; padding: 12px; border: 2px solid ${
                  isUser ? '#4CAF50' : '#2196F3'
                }; border-radius: 10px; background: ${isUser ? '#f1f8e9' : '#e3f2fd'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #333; font-size: 14px;">${
                          isUser ? '👤' : '🤖'
                        } ${name} (#${index})</strong>
                        <div>
                            <button class="mobile-edit-message-btn" data-index="${index}" style="margin-right: 5px; padding: 4px 8px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️</button>
                            <button class="mobile-delete-message-btn" data-index="${index}" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                        </div>
                    </div>
                    <div style="color: #555; white-space: pre-wrap; background: white; padding: 8px; border-radius: 5px; border: 1px solid #ddd; font-size: 13px; line-height: 1.4;">${content}</div>
                </div>
            `;
    });

    html += '</div>';
    $('#mobile-context-editor-content').html(html);
  }

  async editMobileMessage(messageIndex) {
    if (!this.isSillyTavernReady()) return;

    const context = window.SillyTavern.getContext();
    if (messageIndex >= context.chat.length) return;

    const message = context.chat[messageIndex];
    const newContent = prompt('编辑消息内容:', message.mes);

    if (newContent !== null) {
      try {
        await this.modifyMessage(messageIndex, newContent);
        this.renderMobileChatMessages();
        this.updateStatus(`✏️ 已修改消息 ${messageIndex}`);
        this.updateMobileButtonStates();
      } catch (error) {
        this.updateStatus(`❌ 修改失败: ${error.message}`);
      }
    }
  }

  /**
   * 快速修改最后一条消息
   */
  async quickEditLastMessage() {
    try {
      if (!this.isSillyTavernReady()) {
        throw new Error('SillyTavern未准备就绪');
      }

      const context = window.SillyTavern.getContext();
      if (!context.chat || context.chat.length === 0) {
        throw new Error('没有可修改的消息');
      }

      const lastIndex = context.chat.length - 1;
      const lastMessage = context.chat[lastIndex];

      // 创建快速编辑界面
      const quickEditHtml = `
                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">⚡ 快速修改最后一条消息</h4>

                    <div style="margin-bottom: 15px;">
                        <strong>消息发送者：</strong> ${
                          lastMessage.name || (lastMessage.is_user ? '用户' : '角色')
                        } <br>
                        <strong>消息类型：</strong> ${lastMessage.is_user ? '用户消息' : '角色回复'} <br>
                        <strong>消息索引：</strong> ${lastIndex}
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">修改内容：</label>
                        <textarea id="quick-edit-content" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical;">${
                          lastMessage.mes
                        }</textarea>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">修改发送者名称（可选）：</label>
                        <input type="text" id="quick-edit-name" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="留空保持不变" value="${
                          lastMessage.name || ''
                        }">
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.mobileContextEditor.executeQuickEdit(${lastIndex})" style="
                            background: #28a745; color: white; border: none; padding: 10px 20px;
                            border-radius: 5px; cursor: pointer; flex: 1;
                        ">✅ 保存修改</button>

                        <button onclick="window.mobileContextEditor.renderMobileChatMessages()" style="
                            background: #6c757d; color: white; border: none; padding: 10px 20px;
                            border-radius: 5px; cursor: pointer; flex: 1;
                        ">❌ 取消</button>
                    </div>
                </div>
            `;

      $('#mobile-context-editor-content').html(quickEditHtml);
      this.updateStatus('⚡ 快速修改模式已激活');
    } catch (error) {
      console.error('[Mobile Context Editor] 快速修改失败:', error);
      throw error;
    }
  }

  /**
   * 执行快速编辑
   */
  async executeQuickEdit(messageIndex) {
    try {
      const newContent = document.getElementById('quick-edit-content').value;
      const newName = document.getElementById('quick-edit-name').value.trim();

      if (!newContent.trim()) {
        alert('消息内容不能为空');
        return;
      }

      this.updateStatus('💾 正在保存修改...');

      // 执行修改
      await this.modifyMessage(messageIndex, newContent, newName || null);

      // 重新渲染消息列表
      this.renderMobileChatMessages();
      this.updateStatus('✅ 快速修改完成并已保存！');
      this.updateMobileButtonStates();
    } catch (error) {
      console.error('[Mobile Context Editor] 执行快速编辑失败:', error);
      this.updateStatus(`❌ 保存失败: ${error.message}`);
    }
  }

  /**
   * 测试API连接
   */
  async testApiConnection() {
    try {
      this.updateStatus('🔧 正在测试API连接...');

      // 创建测试结果界面
      const testResultHtml = `
                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">🔧 API连接测试</h4>

                    <div id="api-test-results" style="font-family: monospace; font-size: 12px; background: #ffffff; padding: 15px; border-radius: 4px; border: 1px solid #ddd; max-height: 300px; overflow-y: auto;">
                        <div style="color: #007bff;">📊 正在运行测试...</div>
                    </div>

                    <div style="margin-top: 15px;">
                        <button onclick="window.mobileContextEditor.renderMobileChatMessages()" style="
                            background: #007bff; color: white; border: none; padding: 10px 20px;
                            border-radius: 5px; cursor: pointer; width: 100%;
                        ">🔙 返回消息列表</button>
                    </div>
                </div>
            `;

      $('#mobile-context-editor-content').html(testResultHtml);

      // 运行测试
      const results = [];
      const addResult = (test, result, details = '') => {
        results.push(`${result === 'PASS' ? '✅' : '❌'} ${test}: ${result} ${details}`);
        document.getElementById('api-test-results').innerHTML = results.join('<br>');
      };

      // 测试1: SillyTavern基础对象
      addResult('SillyTavern对象', window.SillyTavern ? 'PASS' : 'FAIL');

      // 测试2: 获取上下文
      let context = null;
      try {
        context = window.SillyTavern.getContext();
        addResult('获取上下文', context ? 'PASS' : 'FAIL');
      } catch (error) {
        addResult('获取上下文', 'FAIL', `- ${error.message}`);
      }

      if (context) {
        // 测试3: 聊天数据
        addResult('聊天数据', Array.isArray(context.chat) ? 'PASS' : 'FAIL', `- ${context.chat?.length || 0} 条消息`);

        // 测试4: 角色数据
        addResult(
          '角色数据',
          Array.isArray(context.characters) ? 'PASS' : 'FAIL',
          `- ${context.characters?.length || 0} 个角色`,
        );

        // 测试5: 当前角色
        addResult('当前角色', context.characterId !== undefined ? 'PASS' : 'FAIL', `- ID: ${context.characterId}`);

        // 测试6: 用户名
        addResult('用户名', context.name1 ? 'PASS' : 'FAIL', `- ${context.name1}`);

        // 测试7: 角色名
        addResult('角色名', context.name2 ? 'PASS' : 'FAIL', `- ${context.name2}`);

        // 测试8: 保存函数
        addResult('保存函数', typeof context.saveChat === 'function' ? 'PASS' : 'FAIL');

        // 测试9: 重载函数
        addResult('重载函数', typeof context.reloadCurrentChat === 'function' ? 'PASS' : 'FAIL');

        // 测试10: 添加消息函数
        addResult('添加消息函数', typeof context.addOneMessage === 'function' ? 'PASS' : 'FAIL');

        // 测试11: 尝试获取聊天数据
        try {
          const chatData = this.getCurrentChatData();
          addResult('获取聊天数据', chatData ? 'PASS' : 'FAIL', `- ${chatData?.messages?.length || 0} 条消息`);
        } catch (error) {
          addResult('获取聊天数据', 'FAIL', `- ${error.message}`);
        }

        // 测试12: 尝试获取统计信息
        try {
          const stats = this.getStatistics();
          addResult('获取统计信息', stats ? 'PASS' : 'FAIL', `- ${stats?.totalMessages || 0} 条消息`);
        } catch (error) {
          addResult('获取统计信息', 'FAIL', `- ${error.message}`);
        }
      }

      // 添加总结
      const passCount = results.filter(r => r.includes('✅')).length;
      const totalCount = results.length;
      results.push('');
      results.push(`📊 测试总结: ${passCount}/${totalCount} 项通过`);
      results.push('');
      results.push('🔧 如果有测试失败，请检查SillyTavern是否完全加载');

      document.getElementById('api-test-results').innerHTML = results.join('<br>');
      this.updateStatus(`🔧 API测试完成 - ${passCount}/${totalCount} 项通过`);
    } catch (error) {
      console.error('[Mobile Context Editor] API测试失败:', error);
      this.updateStatus(`❌ API测试失败: ${error.message}`);
    }
  }

  /**
   * 日志记录
   */
  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[Mobile Context Editor] ${message}`;

    switch (level) {
      case 'info':
        // 修复：只在调试模式下输出info级别日志
        if (window.DEBUG_CONTEXT_EDITOR) {
          console.log(logMessage, data);
        }
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
      default:
        if (window.DEBUG_CONTEXT_EDITOR) {
          console.log(logMessage, data);
        }
    }
  }
}

// 创建全局实例
window.mobileContextEditor = new MobileContextEditor();

console.log('[Mobile Context Editor] v2.0 移动端上下文编辑器加载完成 - 使用原生API');
