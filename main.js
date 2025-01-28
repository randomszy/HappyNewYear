class BlessingGenerator {
  constructor() {
    this.chatHistory = [];
    this.currentBlessing = null;
    this.deepseekService = new DeepseekService();
    this.currentRating = 0;
    this.elements = {};
    this.chatInitialized = false;
    this.isGenerating = false;
    this.qrCodeUrl = './images/qrcode.png'; // 替换为实际的二维码图片URL
    this.shareImageConfig = {
      width: 800,
      height: 600,
      padding: 60,
      font: {
        family: '"Microsoft YaHei", "PingFang SC", sans-serif',
        size: 28,
        color: '#722D1E',
        lineHeight: 1.8
      },
      qrCode: {
        size: 100,
        margin: 30
      }
    };
    
    // 预加载背景图片
    this.loadBackgroundImage();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }

    // 引入 marked 库用于解析 markdown
    this.loadMarkdownParser();
  }

  init() {
    this.initUI();
    this.bindEvents();
    this.addLanterns();
  }

  initUI() {
    this.elements = {
      generateBtn: document.querySelector('#generateBtn'),
      blessingResults: document.querySelector('.blessing-results'),
      blessingOptions: document.querySelector('.blessing-options'),
      chatContainer: document.querySelector('.chat-container'),
      chatHistory: document.querySelector('.chat-history'),
      chatInput: document.querySelector('.chat-input textarea'),
      sendBtn: document.querySelector('.send-btn'),
      stars: document.querySelectorAll('.star'),
      ratingContainer: document.querySelector('.rating-container'),
      copyBtn: document.querySelector('#copyBtn'),
      shareBtn: document.querySelector('#shareBtn'),
      shareModal: document.querySelector('.share-modal'),
      closeModal: document.querySelector('.close-modal')
    };

    this.bindRatingEvents();
    this.bindShareEvents();

    // 绑定快速选项事件
    document.querySelectorAll('.quick-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const input = e.target.closest('.form-item').querySelector('input');
        input.value = e.target.dataset.value;
      });
    });

    // 设置其他要求输入框的自动调整
    const requirementsInput = document.querySelector('#requirementsInput');
    if (requirementsInput) {
      // 初始化时调整高度
      this.adjustTextareaHeight(requirementsInput);
      
      // 输入时自动调整高度
      requirementsInput.addEventListener('input', () => {
        this.adjustTextareaHeight(requirementsInput);
      });
    }

    // 绑定分享按钮事件
    const shareBtn = document.querySelector('.share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (this.currentBlessing) {
          this.generateShareImage(this.currentBlessing);
        } else {
          this.handleError(new Error('请先选择一条祝福语'));
        }
      });
    }
  }

  addLanterns() {
    const container = document.querySelector('.festive-background');
    const lanternLeft = document.createElement('div');
    lanternLeft.className = 'lantern lantern-left';
    const lanternRight = document.createElement('div');
    lanternRight.className = 'lantern lantern-right';
    container.appendChild(lanternLeft);
    container.appendChild(lanternRight);
  }

  bindEvents() {
    if (this.elements.generateBtn) {
      this.elements.generateBtn.addEventListener('click', () => this.generateBlessings());
    }

    if (this.elements.sendBtn) {
      this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // 绑定复制和分享按钮事件
    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', () => this.copyBlessing());
    }

    if (this.elements.shareBtn) {
      this.elements.shareBtn.addEventListener('click', () => this.showShareModal());
    }

    if (this.elements.closeModal) {
      this.elements.closeModal.addEventListener('click', () => this.hideShareModal());
    }
  }

  async generateBlessings() {
    console.log('Starting to generate blessings...');
    const params = this.collectParams();
    
    try {
      this.showLoading();
      const response = await this.deepseekService.generateBlessing(params);
      
      if (response && response.blessings) {
        // 显示祝福语和评分区域
        this.displayBlessingAndQuestions(response.blessings, response.questions);
        
        // 滚动到结果区域
        this.elements.blessingResults.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });

        // 初始化聊天区域
        this.initializeChat(response.questions);
      }
    } catch (error) {
      console.error('Generation error:', error);
      this.handleError(error);
    } finally {
      this.hideLoading();
    }
  }

  initializeChat(questions) {
    if (!this.chatInitialized && this.elements.chatContainer) {
      // 显示聊天容器
      this.elements.chatContainer.style.display = 'block';
      
      // 添加系统提示消息，不再包含祝福语
      if (questions?.length > 0) {
        this.updateChatHistory({
          role: 'assistant',
          content: '为了给您提供更好的祝福语建议，请回答以下问题：\n' + 
                   questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
        });
      }

      this.chatInitialized = true;
    }
  }

  displayBlessingAndQuestions(blessings, questions) {
    // 显示祝福语
    if (this.elements.blessingResults) {
      this.elements.blessingResults.style.display = 'block';
      this.displayBlessings(blessings);
    }

    // 显示评分组件
    if (this.elements.ratingContainer) {
      this.elements.ratingContainer.style.display = 'block';
    }
  }

  async submitRating(rating) {
    this.currentRating = rating;
    console.log('提交评分:', rating);
    
    // 将评分添加到聊天历史
    this.updateChatHistory({
      role: 'system',
      content: `用户对祝福语的评分：${rating}星`
    });
  }

  async sendMessage() {
    if (!this.elements.chatInput || this.isGenerating) return;
    
    const message = this.elements.chatInput.value.trim();
    if (!message) return;

    // 添加用户消息到聊天历史
    this.updateChatHistory({
      role: 'user',
      content: message
    });

    this.elements.chatInput.value = '';

    try {
      // 显示生成中状态
      this.isGenerating = true;
      this.updateChatHistory({
        role: 'assistant',
        content: '祝福生成中...',
        isLoading: true
      });

      // 获取新的回复
      const response = await this.deepseekService.continueDialog([...this.chatHistory]);
      
      // 移除加载消息
      this.chatHistory = this.chatHistory.filter(msg => !msg.isLoading);
      
      // 添加助手回复到聊天历史
      this.updateChatHistory({
        role: 'assistant',
        content: response
      });
    } catch (error) {
      console.error('Send message error:', error);
      // 移除加载消息
      this.chatHistory = this.chatHistory.filter(msg => !msg.isLoading);
      this.updateChatHistory({
        role: 'assistant',
        content: '抱歉，生成失败，请重试'
      });
    } finally {
      this.isGenerating = false;
    }
  }

  updateChatHistory(message) {
    this.chatHistory.push(message);
    
    if (!this.elements.chatHistory) return;
    
    // 使用 marked 解析 markdown（如果已加载）
    const parseMarkdown = (content) => {
      return window.marked ? marked.parse(content) : content;
    };
    
    this.elements.chatHistory.innerHTML = this.chatHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => `
        <div class="chat-message ${msg.role} ${msg.isLoading ? 'loading' : ''}">
          <div class="message-content">
            ${parseMarkdown(msg.content)}
          </div>
        </div>
      `).join('');
    
    // 滚动到底部
    this.elements.chatHistory.scrollTop = this.elements.chatHistory.scrollHeight;
  }

  collectParams() {
    return {
      target: document.querySelector('#targetInput')?.value.trim(),
      style: document.querySelector('#styleInput')?.value.trim(),
      length: document.querySelector('#lengthInput')?.value.trim(),
      requirements: document.querySelector('#requirementsInput')?.value.trim() || ''
    };
  }

  // 添加 loading 相关方法
  showLoading() {
    const generateBtn = document.querySelector('#generateBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';
  }

  hideLoading() {
    const generateBtn = document.querySelector('#generateBtn');
    generateBtn.disabled = false;
    generateBtn.textContent = '生成祝福语';
  }

  handleError(error) {
    console.error('Error:', error);
    alert(error.message || '发生错误，请稍后重试');
  }

  bindRatingEvents() {
    if (!this.elements.stars) return;
    
    this.elements.stars.forEach(star => {
      star.addEventListener('mouseover', () => {
        const rating = parseInt(star.dataset.rating);
        this.updateStars(rating, true); // hover效果
      });

      star.addEventListener('mouseout', () => {
        if (!this.currentRating) {
          this.updateStars(0); // 移除所有星星
        } else {
          this.updateStars(this.currentRating); // 恢复之前的评分
        }
      });

      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating);
        this.currentRating = rating;
        this.updateStars(rating);
        this.submitRating(rating);
      });
    });
  }

  updateStars(rating, isHover = false) {
    if (!this.elements.stars) return;
    
    this.elements.stars.forEach(star => {
      const starRating = parseInt(star.dataset.rating);
      if (isHover) {
        star.classList.toggle('hover', starRating <= rating);
      } else {
        star.classList.toggle('active', starRating <= rating);
      }
    });
  }

  bindShareEvents() {
    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', () => {
        this.copyBlessing();
      });
    }

    if (this.elements.shareBtn) {
      this.elements.shareBtn.addEventListener('click', () => {
        this.showShareModal();
      });
    }

    if (this.elements.closeModal) {
      this.elements.closeModal.addEventListener('click', () => {
        this.hideShareModal();
      });
    }
  }

  async copyBlessing() {
    if (!this.currentBlessing) return;
    
    try {
      await navigator.clipboard.writeText(this.currentBlessing);
      this.showSuccessPopup('祝福语已复制到剪贴板！');
    } catch (error) {
      console.error('Copy Error:', error);
      this.showErrorPopup('复制失败，请手动复制');
    }
  }

  async showShareModal() {
    if (!this.currentBlessing) return;

    try {
      // 生成分享图
      const shareImage = await this.generateShareImage();
      
      // 显示分享图和二维码
      const shareImageContainer = this.elements.shareModal.querySelector('.share-image');
      shareImageContainer.innerHTML = `<img src="${shareImage}" alt="分享图片">`;
      
      // TODO: 添加小程序二维码
      const qrcodeContainer = this.elements.shareModal.querySelector('.qrcode');
      qrcodeContainer.innerHTML = `<img src="placeholder-qrcode.png" alt="小程序二维码">`;
      
      this.elements.shareModal.style.display = 'flex';
    } catch (error) {
      console.error('Share Error:', error);
      alert('生成分享图失败，请稍后重试');
    }
  }

  hideShareModal() {
    if (this.elements.shareModal) {
      this.elements.shareModal.style.display = 'none';
    }
  }

  async generateShareImage(blessing) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const config = this.shareImageConfig;

    // 设置画布尺寸
    canvas.width = config.width;
    canvas.height = config.height;

    try {
      // 获取预加载的背景图片
      const backgroundImg = document.getElementById('shareBackground');
      if (!backgroundImg.complete) {
        await new Promise((resolve, reject) => {
          backgroundImg.onload = resolve;
          backgroundImg.onerror = reject;
        });
      }
      
      // 绘制背景
      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      // 设置文字样式
      ctx.font = `${config.font.size}px ${config.font.family}`;
      ctx.fillStyle = config.font.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 绘制祝福语（自动换行）
      const lines = this.wrapText(ctx, blessing, canvas.width - 2 * config.padding);
      const lineHeight = config.font.size * config.font.lineHeight;
      const textY = (canvas.height - lines.length * lineHeight) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, textY + index * lineHeight);
      });

      // 加载并绘制二维码
      if (this.qrCodeUrl) {
        try {
          const qrCode = await this.loadImage(this.qrCodeUrl);
          ctx.drawImage(
            qrCode,
            canvas.width - config.qrCode.size - config.qrCode.margin,
            canvas.height - config.qrCode.size - config.qrCode.margin,
            config.qrCode.size,
            config.qrCode.size
          );
        } catch (error) {
          console.warn('Failed to load QR code:', error);
          // 继续生成图片，即使二维码加载失败
        }
      }

      // 转换为图片并下载或分享
      const dataUrl = canvas.toDataURL('image/png');
      this.shareImage(dataUrl);
    } catch (error) {
      console.error('Generate share image error:', error);
      this.handleError(new Error('生成分享图片失败，请重试'));
    }
  }

  // 修改图片加载方法
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      // 如果是 data URL，直接设置
      if (src.startsWith('data:')) {
        img.src = src;
      } else {
        // 否则尝试通过 FileReader 加载
        fetch(src)
          .then(response => response.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onload = (e) => {
              img.src = e.target.result;
            };
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      }
    });
  }

  // 文字自动换行
  wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    
    for (let char of text) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    
    if (line.length > 0) {
      lines.push(line);
    }
    
    return lines;
  }

  // 分享或下载图片
  shareImage(dataUrl) {
    // 移动端尝试使用系统分享
    if (navigator.share) {
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'blessing.png', { type: 'image/png' });
          navigator.share({
            files: [file],
            title: '祝福语分享',
            text: '为您生成的祝福语'
          }).catch(error => {
            console.log('Share failed:', error);
            this.downloadImage(dataUrl);
          });
        });
    } else {
      // 桌面端直接下载
      this.downloadImage(dataUrl);
    }
  }

  // 下载图片
  downloadImage(dataUrl) {
    const link = document.createElement('a');
    link.download = 'blessing.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  updateCurrentBlessingHint() {
    const hintElement = document.querySelector('.current-blessing-hint');
    if (hintElement && this.currentBlessing) {
      const truncatedBlessing = this.currentBlessing.length > 10 
        ? this.currentBlessing.substring(0, 10) + '...'
        : this.currentBlessing;
      hintElement.textContent = `当前祝福语：${truncatedBlessing}`;
    }
  }

  adjustTextareaHeight(textarea) {
    // 重置高度
    textarea.style.height = 'auto';
    
    // 计算新高度
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + 'px';
  }

  // 加载 marked 库
  loadMarkdownParser() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(script);
  }

  async handleUserResponse(userMessage) {
    try {
      this.showLoading();
      
      // 添加用户消息到聊天历史
      this.updateChatHistory({
        role: 'user',
        content: userMessage
      });

      // 获取新的回复和祝福语
      const response = await this.deepseekService.continueDialogWithNewBlessings([...this.chatHistory]);
      
      // 显示助手回复
      if (response.message) {
        this.updateChatHistory({
          role: 'assistant',
          content: response.message
        });
      }

      // 如果有新的祝福语，更新显示
      if (response.blessings && response.blessings.length > 0) {
        // 更新祝福语选项
        this.displayBlessings(response.blessings);

        // 重新显示评分组件
        if (this.elements.ratingContainer) {
          this.elements.ratingContainer.style.display = 'block';
          // 重置评分
          this.elements.stars.forEach(star => star.classList.remove('selected'));
        }

        // 滚动到新的祝福语区域
        this.elements.blessingResults.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    } catch (error) {
      console.error('Handle user response error:', error);
      this.handleError(error);
    } finally {
      this.hideLoading();
    }
  }

  async loadBackgroundImage() {
    try {
      const response = await fetch('images/background.jpg');
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        this.backgroundImageData = e.target.result;
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to load background image:', error);
    }
  }

  async displayBlessings(blessings) {
    const blessingContainer = document.querySelector('.blessing-options');
    blessingContainer.innerHTML = blessings.map((blessing, index) => `
      <div class="blessing-option">
        <span>${blessing}</span>
        <button class="copy-btn" data-index="${index}">
          <svg t="1738054843459" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2855" width="24" height="24">
            <path d="M394.666667 106.666667h448a74.666667 74.666667 0 0 1 74.666666 74.666666v448a74.666667 74.666667 0 0 1-74.666666 74.666667H394.666667a74.666667 74.666667 0 0 1-74.666667-74.666667V181.333333a74.666667 74.666667 0 0 1 74.666667-74.666666z m0 64a10.666667 10.666667 0 0 0-10.666667 10.666666v448a10.666667 10.666667 0 0 0 10.666667 10.666667h448a10.666667 10.666667 0 0 0 10.666666-10.666667V181.333333a10.666667 10.666667 0 0 0-10.666666-10.666666H394.666667z m245.333333 597.333333a32 32 0 0 1 64 0v74.666667a74.666667 74.666667 0 0 1-74.666667 74.666666H181.333333a74.666667 74.666667 0 0 1-74.666666-74.666666V394.666667a74.666667 74.666667 0 0 1 74.666666-74.666667h74.666667a32 32 0 0 1 0 64h-74.666667a10.666667 10.666667 0 0 0-10.666666 10.666667v448a10.666667 10.666667 0 0 0 10.666666 10.666666h448a10.666667 10.666667 0 0 0 10.666667-10.666666v-74.666667z" fill="#d81e06" p-id="2856"></path>
          </svg>
        </button>
      </div>
    `).join('');

    // 绑定复制按钮事件
    this.bindCopyButtons();
  }

  bindCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        // 使用 button.parentElement 获取祝福语文本
        const blessingText = button.parentElement.querySelector('span').textContent;
        this.copyToClipboard(blessingText);
      });
    });
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccessPopup('祝福语已复制到剪贴板！');
    }).catch(err => {
      console.error('复制失败:', err);
      this.showErrorPopup('复制失败，请手动复制。');
    });
  }

  showSuccessPopup(message) {
    this.showPopup(message, 'success');
  }

  showErrorPopup(message) {
    this.showPopup(message, 'error');
  }

  showPopup(message, type) {
    const popup = document.createElement('div');
    popup.className = `popup ${type}`;
    
    // 使用提供的绿色勾号图标
    const icon = type === 'success' 
      ? `<svg t="1738055162911" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3863" width="24" height="24"><path d="M512 506.311111m-432.355556 0a432.355556 432.355556 0 1 0 864.711112 0 432.355556 432.355556 0 1 0-864.711112 0Z" fill="#1ABA62" p-id="3864"></path><path d="M233.244444 506.311111l238.933334 216.177778 369.777778-329.955556-28.444445-39.822222-335.644444 250.311111-216.177778-130.844444-28.444445 34.133333z" fill="#FFFFFF" p-id="3865"></path></svg>`
      : '';

    popup.innerHTML = `${icon} ${message}`;
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(popup);
      }, 500);
    }, 2000);
  }
} 