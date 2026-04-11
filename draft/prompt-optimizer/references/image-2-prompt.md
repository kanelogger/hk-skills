任务目标
深度分析用户上传的一张图片，将其视觉信息解构为文本语言。请利用你的视觉识别能力，推导出图片背后的创作逻辑，并生成一份极度详细、专业且符合主流AI绘图模型（如Midjourney, Stable Diffusion, FLUX）逻辑的提示词（Prompt）描述。

分析维度要求
一、 艺术风格与媒介 (Art Style & Medium)
核心介质：明确界定图片属性。例如：真实摄影（Photography）、3D渲染（Octane Render/Unreal Engine 5）、数字插画（Digital Painting）、油画（Oil Painting）、矢量艺术（Vector Art）、动漫风格（Anime）等。

流派与美学：具体的艺术流派或视觉风格。例如：赛博朋克（Cyberpunk）、蒸汽波（Vaporwave）、极简主义（Minimalism）、巴洛克风格（Baroque）、浮世绘、超现实主义（Surrealism）。

渲染/画质特征：如果是3D/数字艺术，描述渲染质感（如：CGSociety, ArtStation trending, 8k resolution, Ray tracing）；如果是摄影，描述胶片感（Kodak Portra 400）或数码锐度。

二、 画面主体与细节 (Subject & Details)
核心主体：精准识别画面中心的人物、生物或物体。

外观特征：

人物：年龄、种族、面部特征（雀斑/妆容）、发型发色、眼神方向。

服饰与材质：极其详尽的衣着描述（丝绸/皮革/做旧牛仔/赛博装甲），重点描述材质的物理属性（反光/粗糙/透明/褶皱）。

姿态与神情：描述定格的动作（Pose）。是动态抓拍（奔跑中发丝飞扬）还是静态摆拍（端坐）。描述微表情（嘴角上扬、眉头紧锁、眼神空灵）。

三、 环境与氛围 (Environment & Atmosphere)
物理场景：具体的地点描述（维多利亚式图书馆/雨后的东京街头/外星苔藓地表）。重点描述背景中的陈设细节（散落的书籍、生锈的管道、漂浮的碎石）。

自然元素：天气与空气质感（暴雨、浓雾、丁达尔效应/体积光、飘落的樱花、灰尘颗粒）。

时间与色温：画面所处的时间段（Golden Hour/Blue Hour/正午/午夜霓虹）。

四、 摄影语言与构图 (Camera & Composition)
构图方式：描述画面布局。例如：三分法、中心构图、对称构图、引导线、负空间（Negative Space）、荷兰角（Dutch Angle）。

景别与视角：特写（Close-up）、全身照（Full body shot）、宏大远景（Extreme Wide Shot）、上帝视角（Top-down view）、仰视（Low angle）。

镜头参数（拟真）：

焦段：16mm（超广角冲击力）、35mm（人文纪实）、85mm（人像特写）、200mm（长焦压缩感）。

光圈与景深：f/1.8（浅景深，背景虚化/Bokeh）、f/8（全焦深，清晰背景）。

五、 光影与色彩美学 (Lighting & Color Palette)
光线设计：光源位置（侧光/顶光/背光）、光质（柔光箱/硬光/伦勃朗光/轮廓光/Rim Light）。

色彩方案：主色调（Color Palette），冷暖对比（Teal and Orange），高饱和度或低饱和度（Desaturated），特定的电影调色风格（Cinematic Color Grading）。

输出格式要求
请按照以下结构输出分析结果：

1. 结构化分析 (Structured Analysis)
[风格]：...

[主体]：...

[环境]：...

[视角]：...

2. AI 提示词生成 (Final Prompt Generation)
请基于上述分析，编写一段英文提示词（Prompt）。提示词应包含主体描述 + 环境描述 + 艺术风格 + 技术参数 + 光影氛围。请使用逗号分隔的关键词组形式（Midjourney风格）或长句描述形式（DALL-E 3风格），确保包含高权重的修饰词（Masterpiece, Best quality, Highly detailed）。

输出示例（供参考）
用户上传图片： 一张赛博朋克风格的雨夜街道图。

AI 回复示例：

1. 结构化分析
[风格]：电影级概念艺术，赛博朋克风格，写实渲染（Octane Render）。

[主体]：一位年轻的女性黑客，穿着透明发光的塑料雨衣，戴着机械义眼，手持全息数据板。

[环境]：未来的新东京贫民窟，霓虹灯招牌（汉字与片假名），湿漉漉的沥青地面反射着粉色和蓝色的灯光，大雨倾盆。

[视角]：低角度仰拍（Low angle），广角镜头（24mm），强调背景的高楼压迫感。

[光影]：主要光源来自背景的霓虹灯，人物面部受全息屏幕的冷光照亮，形成强烈的冷暖对比。

2. AI 提示词 (Prompt)
Cinematic shot, Cyberpunk style, a young female hacker standing in a rainy Neo-Tokyo slum, wearing a transparent luminescent plastic raincoat and mechanical cybernetic eyes, holding a holographic data pad, wet asphalt reflecting pink and blue neon lights, heavy rain, atmospheric fog, volumetric lighting, low angle shot, 24mm wide angle lens, high contrast, teal and orange color palette, hyper-realistic, 8k resolution, Unreal Engine 5 render, ray tracing, masterpiece, sharp focus.