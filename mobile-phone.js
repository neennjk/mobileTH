/**
 * กรอบหน้าจอมือถือ
 * อินเทอร์เฟซมือถือสไตล์ iOS น่ารัก
 */

class MobilePhone {
  constructor() {
    this.isVisible = false;
    this.currentApp = null;
    this.apps = {};
    this.appStack = []; // เพิ่มแอปสแต็กเพื่อจัดการการนำทางหน้า
    this.currentAppState = null; // สถานะแอปปัจจุบัน
    this.dragHelper = null; // ตัวช่วยลาก (ปุ่ม)
    this.frameDragHelper = null; // ตัวช่วยลากกรอบ

    // เครื่องหมายกันเด้ง
    this._openingApp = null;
    this._goingHome = false;
    this._returningToApp = null;
    this._lastAppIconClick = 0;
    this._lastBackButtonClick = 0;

    // จัดการสถานะโหลดแอป
    this._loadingApps = new Set(); // แอปที่กำลังโหลด
    this._userNavigationIntent = null; // เจตนานำทางของผู้ใช้
    this._loadingStartTime = {}; // เวลาเริ่มโหลดแอป

    this.init();
  }

  init() {
    this.loadDragHelper();
    this.clearPositionCache(); // ล้างแคชตำแหน่ง
    this.createPhoneButton();
    this.createPhoneContainer();
    this.registerApps();
    this.startClock();

    // เริ่มต้นการตั้งค่าสีข้อความ
    setTimeout(() => {
      this.initTextColor();
    }, 1000); // เริ่มต้นล่าช้า เพื่อให้แน่ใจว่าหน้าโหลดเสร็จ
  }

  // โหลดตัวช่วยลาก
  loadDragHelper() {
    // โหลดสไตล์ CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/scripts/extensions/third-party/mobile/drag-helper.css';
    document.head.appendChild(cssLink);

    // โหลดปลั๊กอิน JS
    if (typeof DragHelper === 'undefined') {
      const script = document.createElement('script');
      script.src = '/scripts/extensions/third-party/mobile/drag-helper.js';
      script.onload = () => {
        console.log('[มือถือ] โหลดปลั๊กอินลากสำเร็จ');
      };
      script.onerror = () => {
        console.error('[มือถือ] โหลดปลั๊กอินลากล้มเหลว');
      };
      document.head.appendChild(script);
    }
  }

  // สร้างปุ่มป๊อปอัพ
  createPhoneButton() {
    try {
      // ตรวจสอบว่ามีปุ่มอยู่แล้วหรือไม่
      const existingButton = document.getElementById('mobile-phone-trigger');
      if (existingButton) {
        console.log('[มือถือ] ปุ่มมีอยู่แล้ว ลบปุ่มเก่า');
        existingButton.remove();
      }

      const button = document.createElement('button');
      button.id = 'mobile-phone-trigger';
      button.className = 'mobile-phone-trigger';
      button.innerHTML = '📱';
      button.title = 'เปิดอินเทอร์เฟซมือถือ';
      button.addEventListener('click', () => this.togglePhone());

      // รับประกัน body มีอยู่
      if (!document.body) {
        console.error('[มือถือ] document.body ไม่มีอยู่ ล่าช้าสร้างปุ่ม');
        setTimeout(() => this.createPhoneButton(), 100);
        return;
      }

      document.body.appendChild(button);

      // เริ่มต้นฟังก์ชันลาก
      this.initDragForButton(button);

      console.log('[มือถือ] สร้างปุ่มมือถือสำเร็จ');
    } catch (error) {
      console.error('[มือถือ] เกิดข้อผิดพลาดขณะสร้างปุ่ม:', error);
    }
  }

  // เริ่มต้นฟังก์ชันลากสำหรับปุ่ม
  initDragForButton(button) {
    // เริ่มต้นล่าช้าเพื่อให้แน่ใจว่า DragHelper โหลดแล้ว
    const tryInitDrag = () => {
      if (typeof DragHelper !== 'undefined') {
        // ทำลายอินสแตนซ์ลากเก่า
        if (this.dragHelper) {
          this.dragHelper.destroy();
        }

        // สร้างอินสแตนซ์ลากใหม่
        this.dragHelper = new DragHelper(button, {
          boundary: document.body,
          clickThreshold: 8, // เพิ่มเกณฑ์คลิกเล็กน้อยเพื่อให้แน่ใจว่าฟังก์ชันคลิกทำงานปกติ
          dragClass: 'mobile-phone-trigger-dragging',
          savePosition: false, // ไม่บันทึกตำแหน่ง
          storageKey: 'mobile-phone-trigger-position',
        });

        console.log('[มือถือ] เริ่มต้นฟังก์ชันลากสำเร็จ');
      } else {
        // ถ้า DragHelper ยังไม่โหลด รอต่อ
        setTimeout(tryInitDrag, 100);
      }
    };

    tryInitDrag();
  }

  // ล้างแคชตำแหน่ง
  clearPositionCache() {
    try {
      // ล้างแคชตำแหน่งปุ่ม
      localStorage.removeItem('mobile-phone-trigger-position');
      // ล้างแคชตำแหน่งกรอบ
      localStorage.removeItem('mobile-phone-frame-position');
      console.log('[มือถือ] ล้างแคชตำแหน่งแล้ว');
    } catch (error) {
      console.warn('[มือถือ] เกิดข้อผิดพลาดขณะล้างแคชตำแหน่ง:', error);
    }
  }

  // เริ่มต้นฟังก์ชันลากสำหรับกรอบมือถือ
  initFrameDrag() {
    // เริ่มต้นล่าช้าเพื่อให้แน่ใจว่า DragHelper โหลดแล้ว
    const tryInitFrameDrag = () => {
      if (typeof DragHelper !== 'undefined') {
        const phoneFrame = document.querySelector('.mobile-phone-frame');
        if (phoneFrame) {
          // ทำลายอินสแตนซ์ลากกรอบเก่า
          if (this.frameDragHelper) {
            this.frameDragHelper.destroy();
          }

          // สร้างอินสแตนซ์ลากใหม่
          this.frameDragHelper = new DragHelper(phoneFrame, {
            boundary: document.body,
            clickThreshold: 10, // เพิ่มเกณฑ์เพื่อหลีกเลี่ยงการสัมผัสผิดพลาด
            dragClass: 'mobile-phone-frame-dragging',
            savePosition: false, // ไม่บันทึกตำแหน่ง
            storageKey: 'mobile-phone-frame-position',
            touchTimeout: 300, // เพิ่มเวลาหมุนเวียนสัมผัส
            dragHandle: '.mobile-status-bar', // กำหนดที่จับลากเป็นแถบสถานะ
          });

          console.log('[มือถือ] เริ่มต้นฟังก์ชันลากกรอบสำเร็จ');
        }
      } else {
        // ถ้า DragHelper ยังไม่โหลด รอต่อ
        setTimeout(tryInitFrameDrag, 100);
      }
    };

    tryInitFrameDrag();
  }

  // สร้างภาชนะมือถือ
  createPhoneContainer() {
    try {
      // ตรวจสอบว่ามีภาชนะอยู่แล้วหรือไม่
      const existingContainer = document.getElementById('mobile-phone-container');
      if (existingContainer) {
        console.log('[มือถือ] ภาชนะมีอยู่แล้ว ลบภาชนะเก่า');
        existingContainer.remove();
      }

      const container = document.createElement('div');
      container.id = 'mobile-phone-container';
      container.className = 'mobile-phone-container';
      container.style.display = 'none';

      container.innerHTML = `
                <div class="mobile-phone-overlay"></div>
                <div class="mobile-phone-frame">
                    <div class="mobile-phone-screen">
                        <!-- แถบสถานะ -->
                        <div class="mobile-status-bar">
                            <div class="status-left">
                                <span class="time" id="mobile-time">08:08</span>
                            </div>
                            <div class="status-center">
                                <div class="dynamic-island"></div>
                            </div>
                            <div class="status-right">
                                <span class="battery">
                                    <span class="battery-icon">🔋</span>
                                    <span class="battery-text">100%</span>
                                </span>
                            </div>
                        </div>

                        <!-- พื้นที่เนื้อหาหลัก -->
                        <div class="mobile-content" id="mobile-content">
                            <!-- หน้าจอหลัก -->
                            <div class="home-screen" id="home-screen">
                                <!-- การ์ดเวลาและสภาพอากาศ -->
                                <div class="weather-card">
                                    <div class="weather-time">
                                        <span class="current-time" id="home-time">08:08</span>
                                        <span class="current-date" id="home-date">08/21</span>
                                    </div>
                                    <div class="weather-info">
                                        <span class="weather-desc">เมฆมากคะนองบางแห่ง · กรุงเทพ</span>
                                    </div>
                                </div>

                                <!-- ตารางไอคอนแอป -->
                                <div class="app-grid">
                                    <!-- แถวแรก: ข้อความ, ช้อปปิ้ง, ภารกิจ -->
                                    <div class="app-row">
                                        <div class="app-icon" data-app="messages">
                                            <div class="app-icon-bg pink">💬</div>
                                            <span class="app-label">ข้อความ</span>
                                        </div>
                                        <div class="app-icon" data-app="shop">
                                            <div class="app-icon-bg purple">ช้อป</div>
                                            <span class="app-label">ช้อปปิ้ง</span>
                                        </div>
                                        <div class="app-icon" data-app="task">
                                            <div class="app-icon-bg purple">📰</div>
                                            <span class="app-label">ภารกิจ</span>
                                        </div>
                                    </div>
                                    <!-- แถวที่สอง: ฟอรัม, เวยป๋อ, ไลฟ์สด -->
                                    <div class="app-row">
                                        <div class="app-icon" data-app="forum">
                                            <div class="app-icon-bg red">📰</div>
                                            <span class="app-label">ฟอรัม</span>
                                        </div>
                                        <div class="app-icon" data-app="weibo">
                                            <div class="app-icon-bg orange" style="font-size: 22px;color:rgba(0,0,0,0.4)">เวย</div>
                                            <span class="app-label">เวยป๋อ</span>
                                        </div>
                                        <div class="app-icon" data-app="live">
                                            <div class="app-icon-bg red">🎬</div>
                                            <span class="app-label">ไลฟ์สด</span>
                                        </div>
                                    </div>
                                    <!-- แถวที่สาม: กระเป๋า, API, ตั้งค่า -->
                                    <div class="app-row">
                                        <div class="app-icon" data-app="backpack">
                                            <div class="app-icon-bg orange">🎒</div>
                                            <span class="app-label">กระเป๋า</span>
                                        </div>
                                        <div class="app-icon" data-app="api">
                                            <div class="app-icon-bg orange" style="font-size: 22px;color:rgba(0,0,0,0.4)">AI</div>
                                            <span class="app-label">API</span>
                                        </div>
                                        <div class="app-icon" data-app="settings">
                                            <div class="app-icon-bg purple">⚙️</div>
                                            <span class="app-label">ตั้งค่า</span>
                                        </div>
                                    </div>
                                    <!-- แอปที่ซ่อน -->
                                    <div style="display: none;">
                                        <div class="app-icon" data-app="gallery">
                                            <div class="app-icon-bg blue">📸</div>
                                            <span class="app-label">แกลเลอรี</span>
                                        </div>
                                        <div class="app-icon" data-app="mail">
                                            <div class="app-icon-bg orange">✉️</div>
                                            <span class="app-label">อีเมล</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- การตกแต่งสัตว์น่ารักด้านล่าง -->
                                <div class="bottom-decoration">
                                    <div class="cute-animal">🐱</div>
                                    <div class="cute-animal">🐶</div>
                                </div>
                            </div>

                            <!-- ภาชนะอินเทอร์เฟซแอป -->
                            <div class="app-screen" id="app-screen" style="display: none;">
                                <div class="app-header" id="app-header">
                                    <button class="back-button" id="back-button">
                                        <span class="back-icon">←</span>
                                    </button>
                                    <h1 class="app-title" id="app-title">แอป</h1>
                                    <div class="app-header-right" id="app-header-right">
                                        <!-- ปุ่มฟังก์ชันไดนามิกจะเพิ่มที่นี่ -->
                                    </div>
                                </div>
                                <div class="app-content" id="app-content">
                                    <!-- เนื้อหาแอปจะโหลดไดนามิกที่นี่ -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.appendChild(container);

      // 加载CSS样式
      this.loadPhoneStyles();

      // 初始化框架拖拽功能
      this.initFrameDrag();

      console.log('[มือถือ] สร้างภาชนะมือถือสำเร็จ');
    } catch (error) {
      console.error('[มือถือ] เกิดข้อผิดพลาดขณะสร้างภาชนะ:', error);
    }
  }

  // โหลดสไตล์มือถือ
  loadPhoneStyles() {
    // 加载主CSS
    const mainCssLink = document.createElement('link');
    mainCssLink.rel = 'stylesheet';
    mainCssLink.href = '/scripts/extensions/third-party/mobile/mobile-phone.css';
    document.head.appendChild(mainCssLink);

    // 加载动画CSS
    const animCssLink = document.createElement('link');
    animCssLink.rel = 'stylesheet';
    animCssLink.href = '/scripts/extensions/third-party/mobile/animations.css';
    document.head.appendChild(animCssLink);

    console.log('[มือถือ] โหลดสไตล์สำเร็จ');
  }

  // 切换手机显示状态
  togglePhone() {
    if (this.isVisible) {
      this.hidePhone();
    } else {
      this.showPhone();
    }
  }

  // 显示手机
  showPhone() {
    if (this.isVisible) {
      console.log('[มือถือ] 手机已显示，跳过重复显示');
      return;
    }

    console.log('[มือถือ] 显示手机界面');
    this.isVisible = true;

    // 显示容器
    const container = document.getElementById('mobile-phone-container');
    if (container) {
      container.style.display = 'block';

      // 动画显示
      setTimeout(() => {
        container.classList.add('phone-visible');
        container.classList.remove('phone-hidden');
      }, 10);

      // 启动状态同步轮询
      this.startStateSyncLoop();

      // 确保主界面显示
      this.goHome();

      console.log('[มือถือ] 手机界面显示完成');
    } else {
      console.error('[มือถือ] 手机容器不存在');
      this.createPhoneContainer();
    }
  }

  // 隐藏手机
  hidePhone() {
    if (!this.isVisible) {
      console.log('[มือถือ] 手机已隐藏，跳过重复隐藏');
      return;
    }

    console.log('[มือถือ] 隐藏手机界面');
    this.isVisible = false;

    // 停止状态同步轮询
    this.stopStateSyncLoop();

    const container = document.getElementById('mobile-phone-container');
    if (container) {
      // 动画隐藏
      container.classList.add('phone-hidden');
      container.classList.remove('phone-visible');

      // 延迟移除显示
      setTimeout(() => {
        container.style.display = 'none';
        container.classList.remove('phone-hidden');
      }, 300);

      console.log('[มือถือ] 手机界面隐藏完成');
    }
  }

  // 注册应用
  registerApps() {
    // 注册内置应用
    this.apps.messages = {
      name: 'ข้อความ',
      icon: '💬',
      content: window.getMessageAppContent ? window.getMessageAppContent() : this.getDefaultMessageAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindMessageAppEvents) {
          window.bindMessageAppEvents();
        }
      },
    };

    this.apps.shop = {
      name: 'ช้อปปิ้ง',
      icon: '🛒',
      content: window.getShopAppContent ? window.getShopAppContent() : this.getDefaultShopAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindShopAppEvents) {
          window.bindShopAppEvents();
        }
      },
    };

    this.apps.task = {
      name: 'ภารกิจ',
      icon: '📋',
      content: window.getTaskAppContent ? window.getTaskAppContent() : this.getDefaultTaskAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindTaskAppEvents) {
          window.bindTaskAppEvents();
        }
      },
    };

    this.apps.forum = {
      name: 'ฟอรัม',
      icon: '🗣️',
      content: window.getForumAppContent ? window.getForumAppContent() : this.getDefaultForumAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindForumAppEvents) {
          window.bindForumAppEvents();
        }
      },
    };

    this.apps.weibo = {
      name: 'เวยป๋อ',
      icon: '👁️',
      content: window.getWeiboAppContent ? window.getWeiboAppContent() : this.getDefaultWeiboAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindWeiboAppEvents) {
          window.bindWeiboAppEvents();
        }
      },
    };

    this.apps.live = {
      name: 'ไลฟ์สด',
      icon: '🎬',
      content: window.getLiveAppContent ? window.getLiveAppContent() : this.getDefaultLiveAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindLiveAppEvents) {
          window.bindLiveAppEvents();
        }
      },
    };

    this.apps.backpack = {
      name: 'กระเป๋า',
      icon: '🎒',
      content: window.getBackpackAppContent ? window.getBackpackAppContent() : this.getDefaultBackpackAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindBackpackAppEvents) {
          window.bindBackpackAppEvents();
        }
      },
    };

    this.apps.api = {
      name: 'API',
      icon: '🔌',
      content: window.getAPIAppContent ? window.getAPIAppContent() : this.getDefaultAPIAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindAPIAppEvents) {
          window.bindAPIAppEvents();
        }
      },
    };

    this.apps.settings = {
      name: 'ตั้งค่า',
      icon: '⚙️',
      content: window.getSettingsAppContent ? window.getSettingsAppContent() : this.getDefaultSettingsAppContent(),
      isCustomApp: true,
      customHandler: () => {
        if (window.bindSettingsAppEvents) {
          window.bindSettingsAppEvents();
        }
      },
    };

    console.log('[มือถือ] ลงทะเบียนแอปสำเร็จ');
  }

  // 回退内容函数（如果自定义内容未加载）
  getDefaultMessageAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปข้อความ...</div>';
  }

  getDefaultShopAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปช้อปปิ้ง...</div>';
  }

  getDefaultTaskAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปภารกิจ...</div>';
  }

  getDefaultForumAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปฟอรัม...</div>';
  }

  getDefaultWeiboAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปเวยป๋อ...</div>';
  }

  getDefaultLiveAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปไลฟ์สด...</div>';
  }

  getDefaultBackpackAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปกระเป๋า...</div>';
  }

  getDefaultAPIAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอป API...</div>';
  }

  getDefaultSettingsAppContent() {
    return '<div class="default-app-content">กำลังโหลดแอปตั้งค่า...</div>';
  }

  // 启动时钟
  startClock() {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const dateString = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

      // อัปเดตเวลาแถบสถานะ
      const mobileTime = document.getElementById('mobile-time');
      if (mobileTime) {
        mobileTime.textContent = timeString;
      }

      // อัปเดตเวลาในหน้าหลัก
      const homeTime = document.getElementById('home-time');
      const homeDate = document.getElementById('home-date');
      if (homeTime) {
        homeTime.textContent = timeString;
      }
      if (homeDate) {
        homeDate.textContent = dateString;
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  // รับประกันมุมมองรากแอป
  getAppRootView(appName) {
    switch (appName) {
      case 'messages':
        return 'messageList';
      default:
        return 'main';
    }
  }

  // กลับไปยังหน้าหลักแอปที่กำหนด (ทั่วไป)
  returnToAppMain(appName) {
    // ตรวจสอบกันเด้ง: ถ้ากำลังกลับไปยังหน้าหลักแอปเดียวกัน ให้ข้าม
    if (this._returningToApp === appName) {
      console.log('[มือถือ] กันเด้ง: กำลังกลับไปยังหน้าหลักแอปเดียวกัน ข้ามการดำเนินการซ้ำ:', appName);
      return;
    }

    // ตรวจสอบว่าอยู่ในหน้าหลักแอปเป้าหมายแล้วหรือไม่
    if (this.currentApp === appName &&
        this.currentAppState &&
        this.currentAppState.app === appName &&
        this.isAppRootPage(this.currentAppState)) {
      console.log('[มือถือ] อยู่ในหน้าหลักแอปเป้าหมายแล้ว ข้ามการดำเนินการซ้ำ:', appName);
      return;
    }

    console.log('=== [มือถือ] returnToAppMain เริ่มต้น ===');
    console.log('[มือถือ] แอปเป้าหมาย:', appName);
    console.log('[มือถือ] สถานะก่อนเรียก:');
    console.log('  - currentApp:', this.currentApp);
    console.log('  - currentAppState:', JSON.stringify(this.currentAppState, null, 2));

    // ตั้งค่ากันเด้ง
    this._returningToApp = appName;

    try {
      // ใช้เมธอดเฉพาะก่อนเพื่อให้แน่ใจว่าสถานะภายในถูกรีเซ็ตทั้งหมด
      if (appName === 'forum') {
        console.log('[มือถือ] ใช้เมธอดเฉพาะ returnToForumMainList');
        this.returnToForumMainList();
        return;
      }
      if (appName === 'messages') {
        console.log('[มือถือ] ใช้เมธอดเฉพาะ returnToMessageList');
        this.returnToMessageList();
        return;
      }

      const app = this.apps[appName];
      if (!app) {
        console.warn('[มือถือ] ไม่พบแอป กลับหน้าหลัก:', appName);
        this.goHome();
        return;
      }

      const rootView = this.getAppRootView(appName);
      const state = {
        app: appName,
        title: app.name,
        view: rootView,
      };

      console.log('[มือถือ] สร้างสถานะใหม่:', JSON.stringify(state, null, 2));

      // รีเซ็ตแอปสแต็กเป็นหน้าหลักแอปนี้
      this.appStack = [state];
      this.currentAppState = state;
      this.currentApp = appName; // ให้แน่ใจว่าแอปปัจจุบันตั้งค่าถูกต้อง
      this.updateAppHeader(state);

      console.log('[มือถือ] หลังอัปเดตสถานะ:');
      console.log('  - currentApp:', this.currentApp);
      console.log('  - currentAppState:', JSON.stringify(this.currentAppState, null, 2));

      // เรนเดอร์หน้าหลัก
      if (app.isCustomApp && app.customHandler) {
        console.log('[มือถือ] เรียกตัวจัดการกำหนดเอง');
        app.customHandler();
      } else if (app.content) {
        console.log('[มือถือ] ใช้เนื้อหาสถิต');
        const contentContainer = document.getElementById('app-content');
        if (contentContainer) contentContainer.innerHTML = app.content;
      }

      // ให้แน่ใจว่าแสดงอินเทอร์เฟซแอป
      const homeEl = document.getElementById('home-screen');
      const appEl = document.getElementById('app-screen');
      if (homeEl && appEl) {
        homeEl.style.display = 'none';
        appEl.style.display = 'block';
      }

      console.log(`[มือถือ] กลับไปยังหน้าหลัก ${appName} แล้ว`);
      console.log('=== [มือถือ] returnToAppMain สิ้นสุด ===');
    } catch (error) {
      console.error('[มือถือ] กลับไปยังหน้าหลักแอปล้มเหลว:', error);
      this.goHome();
    } finally {
      // ล้างกันเด้ง
      setTimeout(() => {
        this._returningToApp = null;
      }, 500);
    }
  }

  // พิจารณาว่าอยู่ในหน้าหลักแอปตามสถานะโมดูลจริง (ใช้สถานะโมดูลก่อน แล้วค่อยถอยไปยัง state)
  isCurrentlyAtAppRoot(appName, state) {
    try {
      if (appName === 'messages') {
        const view = window.messageApp?.currentView;
        if (view) {
          return view === 'list' || view === 'messageList';
        }
        return this.isAppRootPage(state);
      }
      if (appName === 'forum') {
        // DOM ก่อน: ถ้ามีโครงสร้างรายละเอียดโพสต์ ไม่ใช่ราก
        const detailEl = document.querySelector('#forum-content .thread-detail');
        if (detailEl) return false;

        // จากนั้นใช้สถานะโมดูล
        const currentThreadId = window.forumUI?.currentThreadId;
        const view = window.forumUI?.currentView;
        if (typeof currentThreadId !== 'undefined' || typeof view !== 'undefined') {
          if (currentThreadId) return false;
          return !view || view === 'main' || view === 'list';
        }

        // สุดท้ายถอยไปยัง state
        return this.isAppRootPage(state);
      }
      // แอปอื่นๆ ชั่วคราวใช้ state ท้องถิ่น
      return this.isAppRootPage(state);
    } catch (e) {
      console.warn('[มือถือ] isCurrentlyAtAppRoot ตรวจสอบผิดปกติ ถอยไปยัง state:', e);
      return this.isAppRootPage(state);
    }
  }

  // เริ่มต้นลูปซิงค์สถานะ (ซิงค์มุมมองจริงของโมดูลต่างๆ ไปยัง currentAppState)
  startStateSyncLoop() {
    if (this._stateSyncTimer) return; // กำลังรันอยู่

    let lastSignature = '';
    let syncCount = 0;
    const maxSyncCount = 10; // ซิงค์สูงสุด 10 ครั้งก่อนลดความถี่

    const syncOnce = () => {
      try {
        if (!this.currentAppState || !this.isVisible) return;

        // ถ้ากำลังดำเนินการสลับแอป ข้ามซิงค์เพื่อหลีกเลี่ยงความขัดแย้ง
        if (this._openingApp || this._goingHome) {
          return;
        }

        const app = this.currentAppState.app;
        let nextView = this.currentAppState.view || 'main';
        let extra = {};

        if (app === 'messages' && window.messageApp) {
          const view = window.messageApp.currentView;
          if (view === 'messageDetail') {
            nextView = 'messageDetail';
            extra.friendId = window.messageApp.currentFriendId || null;
            extra.friendName = window.messageApp.currentFriendName || null;
          } else if (view === 'addFriend') {
            nextView = 'addFriend';
          } else if (view === 'list' || view === 'messageList') {
            nextView = 'messageList';
          }
        } else if (app === 'forum' && window.forumUI) {
          const threadId = window.forumUI.currentThreadId;
          const view = window.forumUI.currentView;
          if (threadId) {
            nextView = 'threadDetail';
            extra.threadId = threadId;
          } else if (!view || view === 'main' || view === 'list') {
            nextView = 'main';
          }
        }

        const signature = `${app}|${nextView}|${extra.friendId || ''}|${extra.threadId || ''}`;
        if (signature !== lastSignature) {
          lastSignature = signature;

          // สร้างออบเจ็กต์สถานะใหม่
          const newState = {
            ...this.currentAppState,
            view: nextView,
            ...extra,
          };

          // อัปเดตเฉพาะเมื่อสถานะเปลี่ยนจริง
          if (!this.isSameAppState(this.currentAppState, newState)) {
            this.currentAppState = newState;
            this.updateAppHeader(this.currentAppState);
            syncCount++;
            console.log('[มือถือ] ซิงค์มุมมองโมดูลไปยังสถานะ:', this.currentAppState);
          }
        }
      } catch (e) {
        console.warn('[มือถือ] ซิงค์มุมมองโมดูลล้มเหลว:', e);
      }
    };

    // ดำเนินการทันที จากนั้นเข้าลูป
    syncOnce();

    // ปรับความถี่ลูปแบบไดนามิก: ครั้งแรก 10 ครั้งใช้ช่วง 500ms หลังจากนั้น 1000ms
    const getInterval = () => syncCount < maxSyncCount ? 500 : 1000;

    this._stateSyncTimer = setInterval(() => {
      syncOnce();
      // ถ้าจำนวนครั้งซิงค์ถึงเกณฑ์ รีเซ็ตตัวจับเวลาเพื่อลดความถี่
      if (syncCount === maxSyncCount) {
        clearInterval(this._stateSyncTimer);
        this._stateSyncTimer = setInterval(syncOnce, getInterval());
        console.log('[มือถือ] ลดความถี่ซิงค์สถานะเป็น 1000ms แล้ว');
      }
    }, getInterval());

    console.log('[มือถือ] เริ่มต้นลูปซิงค์สถานะ ช่วงเริ่มต้น:', getInterval(), 'ms');
  }

  stopStateSyncLoop() {
    if (this._stateSyncTimer) {
      clearInterval(this._stateSyncTimer);
      this._stateSyncTimer = null;
      console.log('[มือถือ] หยุดลูปซิงค์สถานะแล้ว');
    }
  }

  // รับการตั้งค่าสีข้อความปัจจุบัน
  getCurrentTextColor() {
    // รับจาก Data Bank ของการตั้งค่า CSS ทั่วไป
    if (window.styleConfigManager && window.styleConfigManager.getConfig) {
      const config = window.styleConfigManager.getConfig();
      return config.messageTextColor || 'black';
    }

    // รับจาก localStorage (แผนสำรอง)
    return localStorage.getItem('messageTextColor') || 'black';
  }

  // สลับสีข้อความ
  toggleTextColor() {
    // รับสถานะปัจจุบันจาก DOM โดยตรง น่าเชื่อถือกว่า
    const body = document.body;
    const isCurrentlyWhite = body.classList.contains('text-color-white');
    const newColor = isCurrentlyWhite ? 'black' : 'white';

    console.log(`[มือถือ] สลับสีข้อความ: ${isCurrentlyWhite ? 'ขาว' : 'ดำ'} -> ${newColor}`);

    // บันทึกใน Data Bank การตั้งค่า CSS ทั่วไป
    if (window.styleConfigManager && window.styleConfigManager.updateConfig) {
      window.styleConfigManager.updateConfig({
        messageTextColor: newColor,
      });
    } else {
      // แผนสำรอง: บันทึกใน localStorage
      localStorage.setItem('messageTextColor', newColor);
    }

    // ใช้สีในหน้า
    this.applyTextColor(newColor);

    // อัปเดตข้อความปุ่ม
    this.updateTextColorButton(newColor);

    // แสดงคำแนะนำ
    MobilePhone.showToast(`สลับสีข้อความเป็น${newColor === 'white' ? 'ขาว' : 'ดำ'} แล้ว`);
  }

  // ใช้สีข้อความในหน้า
  applyTextColor(color) {
    const root = document.documentElement;
    const body = document.body;

    // ลบคลาสสีเก่า
    body.classList.remove('text-color-white', 'text-color-black');

    // เพิ่มคลาสสีใหม่
    body.classList.add(`text-color-${color}`);

    // ตั้งค่า CSS variable
    root.style.setProperty('--message-text-color', color === 'white' ? '#fff' : '#000');

    console.log(`[มือถือ] ใช้สีข้อความแล้ว: ${color}`);
  }

  // อัปเดตการแสดงปุ่มสีข้อความ
  updateTextColorButton(color) {
    const button = document.querySelector('.text-color-toggle');
    if (button) {
      // แสดงสีที่จะสลับไป (ตรงข้ามกับปัจจุบัน)
      button.innerHTML = color === 'white' ? 'ดำ' : 'ขาว';
      button.title = `ปัจจุบัน: ${color === 'white' ? 'สีขาว' : 'สีดำ'} คลิกเพื่อสลับเป็น${
        color === 'white' ? 'สีดำ' : 'สีขาว'
      }`;
    }
  }

  // เริ่มต้นการตั้งค่าสีข้อความ
  initTextColor() {
    const savedColor = this.getCurrentTextColor();
    this.applyTextColor(savedColor);
    console.log(`[มือถือ] เริ่มต้นสีข้อความ: ${savedColor}`);
  }

  // แสดงป๊อปอัพกำหนดค่าภาพ
  showImageConfigModal() {
    console.log('[มือถือ] แสดงป๊อปอัพกำหนดค่าภาพ');

    // ให้แน่ใจว่า ImageConfigModal โหลดแล้ว
    if (!window.ImageConfigModal) {
      console.error('[มือถือ] ImageConfigModal ยังไม่โหลด');
      MobilePhone.showToast('ฟังก์ชันกำหนดค่าภาพยังไม่พร้อม', 'error');
      return;
    }

    // แสดงป๊อปอัพ
    window.ImageConfigModal.show();
  }

  // แสดงป๊อปอัพกำหนดค่าภาพเพื่อน
  showFriendImageConfigModal(friendId, friendName) {
    console.log('[มือถือ] แสดงป๊อปอัพกำหนดค่าภาพเพื่อน:', friendId, friendName);

    // ให้แน่ใจว่า FriendImageConfigModal โหลดแล้ว
    if (!window.FriendImageConfigModal) {
      console.error('[มือถือ] FriendImageConfigModal ยังไม่โหลด');
      console.log('[มือถือ] สถานะออบเจ็กต์ global ปัจจุบัน:', {
        ImageConfigModal: typeof window.ImageConfigModal,
        FriendImageConfigModal: typeof window.FriendImageConfigModal,
        styleConfigManager: typeof window.styleConfigManager,
      });

      // พยายามลองใหม่ล่าช้า
      setTimeout(() => {
        if (window.FriendImageConfigModal) {
          console.log('[มือถือ] ลองใหม่ล่าช้าสำเร็จ แสดงป๊อปอัพเพื่อน');
          window.FriendImageConfigModal.show(friendId, friendName);
        } else {
          MobilePhone.showToast('ฟังก์ชันกำหนดค่าภาพเพื่อนยังไม่พร้อม กรุณารีเฟรชหน้า', 'error');
        }
      }, 500);
      return;
    }

    // แสดงป๊อปอัพ
    window.FriendImageConfigModal.show(friendId, friendName);
  }

  // พิจารณาว่าเป็นแชทกลุ่มหรือไม่
  isGroupChat(friendId) {
    // ID กลุ่มแชทมักเริ่มต้นด้วยคำนำหน้าที่กำหนดหรือมีรูปแบบเฉพาะ
    // ที่นี่สามารถปรับตามรูปแบบ ID กลุ่มแชทจริง
    if (!friendId) return false;

    // ตัวอย่างตรรกะการพิจารณา: ID กลุ่มแชทอาจมีอักขระหรือรูปแบบเฉพาะ
    // สามารถปรับตามสถานการณ์จริง
    return friendId.includes('group') || friendId.includes('กลุ่ม') || friendId.length > 10;
  }
}

// เริ่มต้นอินเทอร์เฟซมือถือ
function initMobilePhone() {
  if (document.readyState === 'loading') {
    // ถ้าหนังสือยังโหลด รอ DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      window.mobilePhone = new MobilePhone();
      console.log('[มือถือ] เริ่มต้นอินเทอร์เฟซมือถือเสร็จสิ้น');
    });
  } else {
    // ถ้าหนังสือโหลดเสร็จแล้ว เริ่มต้นทันที
    window.mobilePhone = new MobilePhone();
    console.log('[มือถือ] เริ่มต้นอินเทอร์เฟซมือถือเสร็จสิ้น');
  }
}

// ดำเนินการเริ่มต้นทันที
initMobilePhone();

// สร้างฟังก์ชัน showToast ทั่วไปสำหรับโมดูลอื่นๆ
window.showMobileToast = MobilePhone.showToast.bind(MobilePhone);