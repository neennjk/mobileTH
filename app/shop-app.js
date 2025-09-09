/**
 * Shop App - แอปช้อปปิ้ง
 * ให้ฟังก์ชันช้อปปิ้งสำหรับ mobile-phone.js
 */

// @ts-nocheck
// หลีกเลี่ยงการกำหนดซ้ำ
if (typeof window.ShopApp === 'undefined') {
  class ShopApp {
    constructor() {
      this.currentView = 'productList'; // 'productList', 'cart', 'checkout'
      this.currentTab = 'productList'; // 'productList', 'cart'
      this.currentProductType = 'all'; // 'all', 'ดิจิทัล', 'เสื้อผ้า', 'ของใช้ในบ้าน', etc.
      this.showCategories = false; // แสดงแถบแท็กจำแนกหรือไม่
      this.products = [];
      this.cart = [];
      this.contextMonitor = null;
      this.lastProductCount = 0;
      this.isAutoRenderEnabled = true;
      this.lastRenderTime = 0;
      this.renderCooldown = 1000;
      this.eventListenersSetup = false;
      this.contextCheckInterval = null;

      this.init();
    }

    init() {
      console.log('[Shop App] เริ่ม初始化แอปช้อปปิ้ง - เวอร์ชัน 2.0 (รองรับรูปแบบกระเป๋าเป้)');

      // วิเคราะห์ข้อมูลสินค้าทันที
      this.parseProductsFromContext();

      // 初始化การตรวจสอบแบบอะซิงโครนัส เพื่อหลีกเลี่ยงการบล็อกการเรนเดอร์อินเทอร์เฟซ
      setTimeout(() => {
        this.setupContextMonitor();
      }, 100);

      console.log('[Shop App] 初始化แอปช้อปปิ้งเสร็จ - เวอร์ชัน 2.0');
    }

    // ตั้งค่าการตรวจสอบบริบท
    setupContextMonitor() {
      console.log('[Shop App] ตั้งค่าการตรวจสอบบริบท...');

      // ฟังเหตุการณ์การเปลี่ยนแปลงบริบท
      if (window.addEventListener) {
        window.addEventListener('contextUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การอัปเดตข้อความ
        window.addEventListener('messageUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
        window.addEventListener('chatChanged', event => {
          this.handleContextChange(event);
        });
      }

      // ลดความถี่การตรวจสอบ定时 จาก 2 วินาทีเป็น 10 วินาที
      this.contextCheckInterval = setInterval(() => {
        this.checkContextChanges();
      }, 10000);

      // ฟังระบบเหตุการณ์ของ SillyTavern
      this.setupSillyTavernEventListeners();
    }

    // จัดการการเปลี่ยนแปลงบริบท
    handleContextChange(event) {
      console.log('[Shop App] การเปลี่ยนแปลงบริบท:', event);
      this.parseProductsFromContext();
    }

    // ตรวจสอบการเปลี่ยนแปลงบริบท
    checkContextChanges() {
      if (!this.isAutoRenderEnabled) return;

      const currentTime = Date.now();
      if (currentTime - this.lastRenderTime < this.renderCooldown) {
        return;
      }

      this.parseProductsFromContext();
      this.lastRenderTime = currentTime;
    }

    // ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern
    setupSillyTavernEventListeners() {
      // ป้องกันการตั้งค่าซ้ำ
      if (this.eventListenersSetup) {
        return;
      }

      try {
        // ฟังระบบเหตุการณ์ของ SillyTavern
        const eventSource = window['eventSource'];
        const event_types = window['event_types'];

        if (eventSource && event_types) {
          this.eventListenersSetup = true;

          // สร้างฟังก์ชันเด้ง เพื่อหลีกเลี่ยงการวิเคราะห์บ่อยเกินไป
          const debouncedParse = this.debounce(() => {
            this.parseProductsFromContext();
          }, 1000);

          // ฟังเหตุการณ์ส่งข้อความ
          if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, debouncedParse);
          }

          // ฟังเหตุการณ์รับข้อความ
          if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, debouncedParse);
          }

          // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
          if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, debouncedParse);
          }
        } else {
          // ลดความถี่การลองใหม่ จาก 2 วินาทีเป็น 5 วินาที
          setTimeout(() => {
            this.setupSillyTavernEventListeners();
          }, 5000);
        }
      } catch (error) {
        console.warn('[Shop App] ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern ล้มเหลว:', error);
      }
    }

    // ฟังก์ชันเด้ง
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // วิเคราะห์ข้อมูลสินค้าจากบริบท (เรียนรู้จากลอจิกการวิเคราะห์ของแอปฟอรัม)
    parseProductsFromContext() {
      try {
        // ดึงข้อมูลสินค้าปัจจุบัน
        const shopData = this.getCurrentShopData();

        // อัปเดตรายการสินค้า
        if (shopData.products.length !== this.products.length || this.hasProductsChanged(shopData.products)) {
          this.products = shopData.products;
          this.updateProductList();
        }
      } catch (error) {
        console.error('[Shop App] วิเคราะห์ข้อมูลสินค้าล้มเหลว:', error);
      }
    }

    /**
     * ดึงข้อมูลสินค้าปัจจุบันจากข้อความ (อ้างอิง getCurrentForumData ของแอปฟอรัม)
     */
    getCurrentShopData() {
      try {
        // 優先ใช้ mobileContextEditor เพื่อดึงข้อมูล
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            // ค้นหาทุกข้อความ ไม่จำกัดข้อความแรก
            const allContent = chatData.messages.map(msg => msg.mes || '').join('\n');
            return this.parseShopContent(allContent);
          }
        }

        // หากไม่มี mobileContextEditor ลองวิธีอื่น
        const chatData = this.getChatData();
        if (chatData && chatData.length > 0) {
          // รวมเนื้อหาข้อความทั้งหมดเพื่อวิเคราะห์
          const allContent = chatData.map(msg => msg.mes || '').join('\n');
          return this.parseShopContent(allContent);
        }
      } catch (error) {
        console.warn('[Shop App] ดึงข้อมูลสินค้าล้มเหลว:', error);
      }

      return { products: [] };
    }

    /**
     * วิเคราะห์เนื้อหาสินค้าแบบเรียลไทม์จากข้อความ (อ้างอิง parseForumContent ของแอปฟอรัม)
     */
    parseShopContent(content) {
      // ลบข้อจำกัดเครื่องหมาย วิเคราะห์เนื้อหาทั้งหมดโดยตรง
      const products = [];

      // วิเคราะห์รูปแบบสินค้า: [สินค้า|ชื่อสินค้า|ประเภทสินค้า|คำอธิบายสินค้า|ราคาสินค้า] (‘สินค้า’ เป็นตัวบ่งชี้คงที่)
      const productRegex = /\[สินค้า\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/g;

      let productMatch;
      while ((productMatch = productRegex.exec(content)) !== null) {
        const [fullMatch, name, type, description, price] = productMatch;

        // ตรวจสอบว่ามีสินค้าเดียวกันอยู่แล้วหรือไม่ (ตัดสินจากชื่อและประเภท)
        const existingProduct = products.find(p => p.name.trim() === name.trim() && p.type.trim() === type.trim());

        if (!existingProduct) {
          const newProduct = {
            id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(), // ใช้ชื่อสินค้า
            type: type.trim(),
            description: description.trim(),
            price: parseFloat(price.trim()) || 0,
            image: this.getProductImage(type.trim()),
            stock: Math.floor(Math.random() * 50) + 10, // สต็อกสุ่ม
            timestamp: new Date().toLocaleString(),
          };
          products.push(newProduct);
        }
      }

      console.log('[Shop App] วิเคราะห์เสร็จ จำนวนสินค้า:', products.length);
      return { products };
    }

    // ตรวจสอบว่าสินค้ามีการเปลี่ยนแปลงหรือไม่ (วิธีเปรียบเทียบที่มีประสิทธิภาพมากขึ้น)
    hasProductsChanged(newProducts) {
      if (newProducts.length !== this.products.length) {
        return true;
      }

      for (let i = 0; i < newProducts.length; i++) {
        const newProduct = newProducts[i];
        const oldProduct = this.products[i];

        if (
          !oldProduct ||
          newProduct.name !== oldProduct.name ||
          newProduct.type !== oldProduct.type ||
          newProduct.description !== oldProduct.description ||
          newProduct.price !== oldProduct.price
        ) {
          return true;
        }
      }

      return false;
    }

    // ดึงรูปภาพสินค้า
    getProductImage(type) {
      const imageMap = {
        อาหาร: '🍎',
        อาหาร: '🍎', // รองรับการเขียน "อาหาร"
        เครื่องดื่ม: '🥤',
        เสื้อผ้า: '👔',
        ดิจิทัล: '📱',
        ของใช้ในบ้าน: '🏠',
        เครื่องสำอาง: '💄',
        กีฬา: '⚽',
        หนังสือ: '📚',
        ของเล่น: '🧸',
        ดนตรี: '🎵',
        ค่าเริ่มต้น: '🛒',
      };
      return imageMap[type] || imageMap['ค่าเริ่มต้น'];
    }

    // ดึงข้อมูลแชท
    getChatData() {
      try {
        // 優先ใช้ mobileContextEditor เพื่อดึงข้อมูล
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            return chatData.messages;
          }
        }

        // ลองดึงจากตัวแปรทั่วไป
        const chat = window['chat'];
        if (chat && Array.isArray(chat)) {
          return chat;
        }

        // ลองดึงจากตำแหน่งอื่นที่เป็นไปได้
        const SillyTavern = window['SillyTavern'];
        if (SillyTavern && SillyTavern.chat) {
          return SillyTavern.chat;
        }

        return [];
      } catch (error) {
        console.error('[Shop App] ดึงข้อมูลแชตล้มเหลว:', error);
        return [];
      }
    }

    // ดึงเนื้อหาแอป
    getAppContent() {
      // ลบลอจิกวิเคราะห์ทุกครั้ง เปลี่ยนเป็นวิเคราะห์เฉพาะเมื่อจำเป็น
      switch (this.currentView) {
        case 'productList':
          return this.renderProductList();
        case 'cart':
          return this.renderCart();
        case 'checkout':
          return this.renderCheckout();
        default:
          return this.renderProductList();
      }
    }

    // เรนเดอร์แท็บหน้าช้อปปิ้ง
    renderShopTabs() {
      const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      const productCount = this.products.length;

      return `
          <div class="shop-tabs">
              <button class="shop-tab ${this.currentTab === 'productList' ? 'active' : ''}"
                      data-tab="productList">
                  รายการสินค้า (${productCount})
              </button>
              <button class="shop-tab ${this.currentTab === 'cart' ? 'active' : ''}"
                      data-tab="cart">
                  ตะกร้าสินค้า (${totalItems})
              </button>
          </div>
      `;
    }

    // เรนเดอร์รายการสินค้า
    renderProductList() {
      console.log('[Shop App] เรนเดอร์รายการสินค้า...');

      // ดึงประเภทสินค้าทั้งหมด
      const allTypes = ['all', ...new Set(this.products.map(p => p.type))];

      // กรองสินค้าตามประเภทที่เลือกปัจจุบัน
      const filteredProducts =
        this.currentProductType === 'all'
          ? this.products
          : this.products.filter(p => p.type === this.currentProductType);

      if (!this.products.length) {
        return `
                <div class="shop...(truncated 11386 characters)...ตำแหน่งเลื่อน
      this.updateCartBadge();
    }

    // ลบจากตะกร้าสินค้า
    removeFromCart(productId) {
      this.cart = this.cart.filter(item => item.id !== productId);
      this.updateAppContent(true); // รักษาตำแหน่งเลื่อน
      this.updateCartBadge();
    }

    // อัปเดตป้ายตะกร้าสินค้า
    updateCartBadge() {
      const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

      // อัปเดตเฉพาะจำนวนในแท็บตะกร้าสินค้า ไม่เรนเดอร์หน้าทั้งหมดใหม่
      const cartTab = document.querySelector('.shop-tab[data-tab="cart"]');
      if (cartTab) {
        cartTab.textContent = `ตะกร้าสินค้า (${totalItems})`;
      }
    }

    // แสดงรายการสินค้า
    showProductList() {
      this.currentView = 'productList';
      this.currentTab = 'productList';
      this.updateAppContent();
      this.updateHeader();
    }

    // แสดงตะกร้าสินค้า
    showCart() {
      this.currentView = 'cart';
      this.currentTab = 'cart';
      this.updateAppContent();
      this.updateHeader();
    }

    // แสดงหน้าชำระเงิน
    showCheckout() {
      if (this.cart.length === 0) {
        this.showToast('ตะกร้าสินค้าว่าง', 'warning');
        return;
      }

      this.currentView = 'checkout';
      this.updateAppContent();
      this.updateHeader();
    }

    // ยืนยันคำสั่งซื้อ
    confirmOrder() {
      if (this.cart.length === 0) {
        this.showToast('ตะกร้าสินค้าว่าง', 'warning');
        return;
      }

      // สร้างสรุปคำสั่งซื้อ
      const orderSummary = this.generateOrderSummary();

      // ส่งข้อความไปยัง SillyTavern
      this.sendOrderToSillyTavern(orderSummary);

      // ล้างตะกร้าสินค้า
      this.cart = [];
      this.updateCartBadge();

      // แสดงข้อความสำเร็จ
      this.showToast('ยืนยันคำสั่งซื้อแล้ว!', 'success');

      // กลับไปรายการสินค้า
      setTimeout(() => {
        this.showProductList();
      }, 1500);
    }

    // สร้างสรุปคำสั่งซื้อ
    generateOrderSummary() {
      const totalPrice = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

      const itemsList = this.cart
        .map(item => `${item.name} x${item.quantity} = ¥${(item.price * item.quantity).toFixed(2)}`)
        .join('\n');

      return `ยืนยันคำสั่งซื้อ：
${itemsList}
รวม: ${totalItems} ชิ้นสินค้า, ¥${totalPrice.toFixed(2)}`;
    }

    // ส่งคำสั่งซื้อไปยัง SillyTavern (เปลี่ยนเป็นส่งพร้อมคำอธิบายค่าใช้จ่ายและรูปแบบกระเป๋าเป้)
    sendOrderToSillyTavern(orderSummary) {
      try {
        console.log('[Shop App] ส่งคำสั่งซื้อไปยัง SillyTavern');

        // คำนวณราคารวมและชื่อสินค้าที่ได้รับ
        const totalPrice = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const itemNames = this.cart.map(item => `${item.name}x${item.quantity}`).join('、');

        // สร้างข้อความรูปแบบกระเป๋าเป้: [กระเป๋าเป้|ชื่อสินค้า|ประเภทสินค้า|คำอธิบายสินค้า|จำนวน]
        const bagMessages = this.cart
          .map(item => `[กระเป๋าเป้|${item.name}|${item.type}|${item.description}|${item.quantity}]`)
          .join('');

        // รวมข้อความสุดท้าย
        const finalMessage = `ผู้ใช้ซื้อสินค้าในห้าง ค่าใช้จ่าย ${totalPrice} หยวน (กรุณาอัปเดตตัวแปรยอดเงินผู้ใช้ให้ถูกต้อง หักค่าใช้จ่ายการช้อปครั้งนี้) ได้รับ ${itemNames}。${bagMessages}`;
        console.log('[Shop App] ข้อความส่งสุดท้าย:', finalMessage);

        // ใช้การส่งเหมือนกับ message app
        this.sendToSillyTavern(finalMessage);
      } catch (error) {
        console.error('[Shop App] ส่งคำสั่งซื้อล้มเหลว:', error);
      }
    }

    // ส่งข้อความดูสินค้า
    sendViewProductsMessage() {
      try {
        console.log('[Shop App] ส่งข้อความดูสินค้า');

        const message = 'ดูสินค้า';

        // ใช้การส่งเหมือนกับ message app
        this.sendToSillyTavern(message);
      } catch (error) {
        console.error('[Shop App] ส่งข้อความดูสินค้าล้มเหลว:', error);
      }
    }

    // วิธีส่งข้อความที่เป็นเอกภาพ (อ้างอิง sendToChat ของ message app)
    async sendToSillyTavern(message) {
      try {
        console.log('[Shop App] 🔄 ใช้เวอร์ชันส่งใหม่ v2.0 - ส่งข้อความไปยัง SillyTavern:', message);

        // วิธีที่ 1: ใช้ DOM element โดยตรง (เหมือนกับ message app)
        const originalInput = document.getElementById('send_textarea');
        const sendButton = document.getElementById('send_but');

        if (!originalInput || !sendButton) {
          console.error('[Shop App] ไม่พบช่องกรอกหรือปุ่มส่ง');
          return this.sendToSillyTavernBackup(message);
        }

        // ตรวจสอบว่าช่องกรอกใช้งานได้หรือไม่
        if (originalInput.disabled) {
          console.warn('[Shop App] ช่องกรอกถูกปิดใช้งาน');
          return false;
        }

        // ตรวจสอบว่าปุ่มส่งใช้งานได้หรือไม่
        if (sendButton.classList.contains('disabled')) {
          console.warn('[Shop App] ปุ่มส่งถูกปิดใช้งาน');
          return false;
        }

        // ตั้งค่า
        originalInput.value = message;
        console.log('[Shop App] ตั้งค่าค่าช่องกรอกแล้ว:', originalInput.value);

        // กระตุ้นเหตุการณ์กรอก
        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
        originalInput.dispatchEvent(new Event('change', { bubbles: true }));

        // ล่าช้าในการคลิกปุ่มส่ง
        await new Promise(resolve => setTimeout(resolve, 300));
        sendButton.click();
        console.log('[Shop App] คลิกปุ่มส่งแล้ว');

        return true;
      } catch (error) {
        console.error('[Shop App] เกิดข้อผิดพลาดในการส่งข้อความ:', error);
        return this.sendToSillyTavernBackup(message);
      }
    }

    // วิธีส่งสำรอง
    async sendToSillyTavernBackup(message) {
      try {
        console.log('[Shop App] ลองวิธีส่งสำรอง:', message);

        // ลองหาช่องกรอกอื่นที่เป็นไปได้
        const textareas = document.querySelectorAll('textarea');
        const inputs = document.querySelectorAll('input[type="text"]');

        if (textareas.length > 0) {
          const textarea = textareas[0];
          textarea.value = message;
          textarea.focus();

          // จำลองเหตุการณ์คีย์บอร์ด
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Shop App] วิธีส่งสำรองล้มเหลว:', error);
        return false;
      }
    }

    // รีเฟรชรายการสินค้าด้วยตนเอง
    refreshProductList() {
      console.log('[Shop App] รีเฟรชรายการสินค้าด้วยตนเอง');
      this.parseProductsFromContext();
      this.updateAppContent();
    }

    // ทำลายแอป ทำความสะอาดทรัพยากร
    destroy() {
      console.log('[Shop App] ทำลายแอป ทำความสะอาดทรัพยากร');

      // ทำความสะอาดตัวจับเวลา
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
        this.contextCheckInterval = null;
      }

      // รีเซ็ตสถานะ
      this.eventListenersSetup = false;
      this.isAutoRenderEnabled = false;

      // ล้างข้อมูล
      this.products = [];
      this.cart = [];
    }

    // อัปเดต header
    updateHeader() {
      // แจ้ง mobile-phone เพื่ออัปเดต header
      if (window.mobilePhone && window.mobilePhone.updateAppHeader) {
        const state = {
          app: 'shop',
          title: this.getViewTitle(),
          view: this.currentView,
        };
        window.mobilePhone.updateAppHeader(state);
      }
    }

    // ดึงชื่อมุมมอง
    getViewTitle() {
      return 'ช้อปปิ้ง';
    }

    // แสดงข้อความแจ้งเตือน
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `shop-toast ${type}`;
      toast.textContent = message;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 100);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
    }
  }

  // สร้างอินสแตนซ์ทั่วไป
  window.ShopApp = ShopApp;
  window.shopApp = new ShopApp();
} // สิ้นสุดการตรวจสอบนิยามคลาส

// ฟังก์ชันทั่วไปสำหรับ mobile-phone.js เรียกใช้
window.getShopAppContent = function () {
  console.log('[Shop App] ดึงเนื้อหาแอปช้อปปิ้ง');

  if (!window.shopApp) {
    console.error('[Shop App] อินสแตนซ์ shopApp ไม่มี');
    return '<div class="error-message">โหลดแอปช้อปปิ้งล้มเหลว</div>';
  }

  try {
    return window.shopApp.getAppContent();
  } catch (error) {
    console.error('[Shop App] ดึงเนื้อหาแอปล้มเหลว:', error);
    return '<div class="error-message">ดึงเนื้อหาล้มเหลว</div>';
  }
};

window.bindShopAppEvents = function () {
  console.log('[Shop App] ผูกเหตุการณ์แอปช้อปปิ้ง');

  if (!window.shopApp) {
    console.error('[Shop App] อินสแตนซ์ shopApp ไม่มี');
    return;
  }

  try {
    window.shopApp.bindEvents();
  } catch (error) {
    console.error('[Shop App] ผูกเหตุการณ์ล้มเหลว:', error);
  }
};

// ฟังก์ชันเพิ่มเติมสำหรับ mobile-phone.js เรียกใช้
window.shopAppShowCart = function () {
  if (window.shopApp) {
    window.shopApp.showCart();
  }
};

window.shopAppSendViewMessage = function () {
  if (window.shopApp) {
    window.shopApp.sendViewProductsMessage();
  }
};

window.shopAppToggleCategories = function () {
  if (window.shopApp) {
    window.shopApp.toggleCategories();
  }
};

// ฟังก์ชันดีบักและทดสอบ
window.shopAppRefresh = function () {
  if (window.shopApp) {
    window.shopApp.refreshProductList();
  }
};

window.shopAppDebugInfo = function () {
  if (window.shopApp) {
    console.log('[Shop App Debug] จำนวนสินค้าปัจจุบัน:', window.shopApp.products.length);
    console.log('[Shop App Debug] รายการสินค้า:', window.shopApp.products);
    console.log('[Shop App Debug] ตะกร้าสินค้า:', window.shopApp.cart);
    console.log('[Shop App Debug] มุมมองปัจจุบัน:', window.shopApp.currentView);
    console.log('[Shop App Debug] ตั้งค่าฟังก์ชันฟังเหตุการณ์:', window.shopApp.eventListenersSetup);
    console.log('[Shop App Debug] เปิดใช้งานการเรนเดอร์อัตโนมัติ:', window.shopApp.isAutoRenderEnabled);
  }
};

// ปรับปรุงประสิทธิภาพ: ทำลายอินสแตนซ์แอป
window.shopAppDestroy = function () {
  if (window.shopApp) {
    window.shopApp.destroy();
    console.log('[Shop App] แอปถูกทำลายแล้ว');
  }
};

// โหลดแอปใหม่แบบบังคับ (ล้างแคช)
window.shopAppForceReload = function () {
  console.log('[Shop App] 🔄 โหลดแอปใหม่แบบบังคับ...');

  // ทำลายอินสแตนซ์ที่มีอยู่
  if (window.shopApp) {
    window.shopApp.destroy();
  }

  // สร้างอินสแตนซ์ใหม่
  window.shopApp = new ShopApp();
  console.log('[Shop App] ✅ โหลดแอปใหม่แล้ว - เวอร์ชัน 2.0');
};

// ตรวจสอบเวอร์ชันการส่ง
window.shopAppCheckVersion = function () {
  console.log('[Shop App] 📋 ตรวจสอบเวอร์ชัน:');
  console.log('- วิธี sendToSillyTavern:', typeof window.shopApp?.sendToSillyTavern);
  console.log('- วิธี sendOrderToSillyTavern:', typeof window.shopApp?.sendOrderToSillyTavern);
  console.log('- วิธี sendViewProductsMessage:', typeof window.shopApp?.sendViewProductsMessage);

  if (window.shopApp?.sendToSillyTavern) {
    console.log('✅ วิธีส่งเวอร์ชันใหม่โหลดแล้ว');
  } else {
    console.log('❌ ไม่พบวิธีส่งเวอร์ชันใหม่ กรุณาโหลดหน้าผ่านใหม่');
  }
};

// 初始化
console.log('[Shop App] โหลดโมดูลแอปช้อปปิ้งเสร็จ - เวอร์ชัน 2.0 (รองรับรูปแบบกระเป๋าเป้)');