引导 UI 使用说明
import {showHint,showBanner,hideHint,hideBanner,setChapter} from '../../ui/guide.js';
showHint('按 **WASD** 开始行走',{keys:'wasd',duration:5000});
showHint('按 **空格** 跳跃',{keys:'space',duration:0});
showHint('移动 **鼠标** 查看四周',{keys:'mouse'});
showBanner('抵达 **回声树屋**','✧');
setChapter(1); // 1 蓝绿、2 粉紫、3 暖黄
hint duration 单位毫秒，0 表示保持，默认 5000。横幅默认 4500 毫秒。
也可通过 window.CloudGuide 使用同名接口。
ui/demo.html 可预览三种主题、按键动画和显隐。
P 键输出坐标，输入框中不触发。第一、二关已绑定玩家位置。
第三关：将 unity/CloudGuidePosition.cs 放入 Unity Assets，挂到玩家实际移动的根对象；将 CloudGuide.jslib 放入 Assets/Plugins/WebGL，重新构建 WebGL。现有编译包未重构，第三关 P 暂不能输出坐标。
当前只接入通用接口，未自动安排引导触发点或替换原有任务 UI。
