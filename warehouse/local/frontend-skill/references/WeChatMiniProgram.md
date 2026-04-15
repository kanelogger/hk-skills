# WeChat Mini Program Development Rules

## Mandatory Development Rules

### 1. Code Reading Requirement
**🔴 CRITICAL**: 修改代码前必须要阅读完整的代码文件
- 在进行任何代码修改之前，必须先完整阅读目标文件
- 理解现有代码逻辑、依赖关系和数据流
- 不得基于假设或部分理解进行修改
- 修改前检查相关的配置文件和依赖

### 2. Business Logic Analysis Requirement
**🔴 CRITICAL**: 分析业务逻辑时要阅读相关的完整代码，并且不得遗漏
- 分析业务功能时必须阅读完整的调用链路
- 包括但不限于：页面逻辑、API调用、数据处理、状态管理
- 检查所有相关的工具函数、组件和配置文件
- 确保理解数据的完整流转过程

### 3. WeChat Mini Program Specific Rules
- **Component WXSS**: 只允许使用类选择器，禁止使用标签选择器、ID选择器和属性选择器
- **API Integration**: 所有API调用必须通过 `utils/api.js` 封装，不直接使用 `wx.request`
- **Authentication**: 必须使用 `app.js` 中的安全认证方法，不直接操作本地存储
- **Global State**: 通过 `app.globalData` 管理全局状态，不使用全局变量

### 4. File Operation Rules
- 修改任何文件前必须先备份理解其作用
- 新增文件必须放在正确的目录结构中
- 遵循现有的命名约定和代码风格
- 不删除任何文件，除非确认其不再被使用

### 5. Data Format Rules
- **Gender Format**: 存储使用英文格式 ('male'/'female')，显示使用中文格式 ('男'/'女')
- **Token Management**: JWT token 必须包含 Bearer 前缀，过期处理必须调用 `handleTokenExpired`
- **Date Format**: 统一使用 ISO 格式存储，显示时转换为本地格式

### 6. Error Handling Rules
- 所有 API 调用必须包含 try-catch 或 Promise catch
- 网络错误必须提供用户友好的提示信息
- 401/403 错误必须触发重新认证流程
- 不得静默忽略错误

### 7. Security Rules
- 不在前端代码中存储敏感信息
- 所有请求必须包含认证 token
- 用户输入必须进行验证和清理
- Token 过期必须立即清除所有本地状态

## Quality Standards

### Code Quality
- 使用现代 JavaScript (ES6+) 语法
- 保持函数和方法的单一职责
- 添加必要的注释说明复杂逻辑
- 保持一致的代码缩进和格式

### Performance
- 避免不必要的页面重复渲染
- 使用 `wx.nextTick` 优化DOM更新
- 图片资源必须压缩和优化
- 长列表使用虚拟滚动或分页加载

### User Experience
- 所有异步操作必须显示加载状态
- 网络请求必须有超时处理
- 用户操作必须有即时反馈
- 错误信息必须清晰且可操作

## Development Workflow

### Before Making Changes
1. 阅读 `CLAUDE.md` 了解项目架构
2. 完整阅读目标文件和相关依赖
3. 检查是否有现有的测试文件
4. 确认修改不会影响其他功能

### During Development
1. 遵循现有的代码风格和模式
2. 使用项目定义的工具函数和组件
3. 保持向后兼容性
4. 及时更新相关文档

### After Making Changes
1. 在微信开发者工具中测试功能
2. 检查控制台是否有错误或警告
3. 验证在不同网络条件下的表现
4. 确认用户体验流畅

## Common Patterns

### Authentication Check
```javascript
const currentUser = app.getCurrentUser();
if (!currentUser.isLoggedIn) {
  // 使用登录重定向系统
  const redirectUrl = getCurrentPageUrl();
  wx.navigateTo({
    url: `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`
  });
  return false;
}
```

### API Call Pattern
```javascript
try {
  const result = await someAPI.method(params);
  // 处理成功响应
} catch (error) {
  console.error('API调用失败:', error);
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}
```

### Data Storage Pattern
```javascript
// 存储格式
const userData = {
  gender: 'male', // 英文格式
  age: 8
};
wx.setStorageSync('user_data', userData);

// 显示时转换
const displayGender = userData.gender === 'male' ? '男' : '女';
```

## Prohibited Actions

### ❌ Never Do
- 直接修改 `app.js` 中的核心认证逻辑
- 绕过 `utils/api.js` 直接发起网络请求
- 在组件 WXSS 中使用非类选择器
- 硬编码 API 地址或敏感信息
- 忽略错误处理和用户反馈
- 修改文件而不理解其完整功能

### ⚠️ Require Approval
- 修改认证和授权流程
- 更改全局状态管理结构
- 修改核心业务逻辑
- 更新 API 接口定义
- 更改微信小程序配置文件