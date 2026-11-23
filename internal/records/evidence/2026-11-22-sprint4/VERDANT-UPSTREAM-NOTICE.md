# 第三方材料与归属

Verdant 源码采用 AGPL-3.0-or-later。下列依赖、资料和研究引用保留各自的作者、来源与许可。[Verdant 许可证](LICENSE)

## UtaFormatix 官方四音符回归夹具

`frontend/crates/verdant-exchange/tests/fixtures/ufdata/official-standard-midi.ufdata`
是 UtaFormatix 官方仓库中未改动的四音符唱名诊断谱，来源为
[`sdercolin/utaformatix3`](https://github.com/sdercolin/utaformatix3/blob/91d0aeb994bc846e380ea98cd4c6f75c5ea7c6ae/src/jsTest/resources/fixtures/standard_mid_import.ufdata)，
固定 commit `91d0aeb994bc846e380ea98cd4c6f75c5ea7c6ae`，Git blob
`0f7c087d5637b8adec83fb08f001a71b565be975`。

该夹具的上游版权声明为 **Copyright 2020 sdercolin**，依据 Apache License 2.0 提供。
上游声明保存在同目录的 `UPSTREAM-LICENSE.txt`，完整条款保存在
[`LICENSE-APACHE-2.0.txt`](frontend/crates/verdant-exchange/tests/fixtures/ufdata/LICENSE-APACHE-2.0.txt)，
条款原文来源为 [Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt)。
此归属只指上述官方四音符夹具，不包含录音、声库或合成引擎，也不改变 Verdant 其他源码各自已有的许可。
同目录 `multitrack-controls.ufdata` 是 Verdant 自行编写的测试数据；详细范围见该目录的 README。

## 《河蟹你全家》内建短句谱例

`frontend/crates/verdant-app/assets/examples/hexie-title-excerpt.verp`
引用《绿坝绿坝★河蟹你全家feveR.》的一个八字短句，整理成约 2.625 秒的可编辑谱例。
原曲为 **《ルカルカ★ナイトフィーバー》**，原曲词曲 **samfree（SAM）**；
中文填词、原版调声 **荼荼丸**。

来源：[历史原版视频](https://www.bilibili.com/video/BV1xx411c7BF/)、
[2009 年同期文字及署名记录](https://elielin.hatenablog.com/entry/20090624/p1)。
示例仅对短句的主要音高和节拍作近似整理，不是官方曲谱或作者授权配布的全曲工程。
未附原录音、伴奏、全曲歌词或下载的完整 MIDI/UST/VSQ。
原作品权利保留；软件及整理代码的许可不扩大到所引用歌曲材料。
程序菜单及保存后的工程元数据均保留这些署名与来源。

## 早期朗读软件女童声（「绿坝1号音源」所用原始声线）

`sn16k.tkn` 和 `sn16k.bin` 来自早期中文朗读软件安装包内置的女童声。该声线是二次创作中「绿坝1号音源」的原始来源：2009 年 6 月 19 日，荼荼丸以该内置女童声提升 25% 音高制作变调音源，用于同人歌曲《绿坝绿坝☆河蟹你全家feveR.》。本项目使用安装包的原始女童声，不使用该变调版本。原文件、叶统计量和派生模型保留第三方归属。声库准入绑定文件与来源哈希，随包分发另需取得每项材料的相应授权。[资料取得与哈希](https://github.com/OpenGreendam/docs/blob/main/greendam-reproduction-2026-11-13/docs/previous-static-investigation/acquisition.md) · [分发政策](RELEASE.md)

## OpenVPI PC-NSF-HiFiGAN 权重

早期 C1 CPU 路线曾使用 OpenVPI Team 的 `pc_nsf_hifigan_44.1k_hop512_128bin_2025.02.onnx`。权重遵循 CC BY-NC-SA 4.0。官方文本与训练数据致谢原样保留。[OpenVPI 发行](https://github.com/openvpi/vocoders/releases/tag/pc-nsf-hifigan-44.1k-hop512-128bin-2025.02) · [许可](https://creativecommons.org/licenses/by-nc-sa/4.0/) · [原文通知](docs/archive/research/licenses/vocoder/)

## 对照源码和运行依赖

DiffSinger 接口对照固定到 `cb7869b8733a3882679c328994ee162845092cff`。[Apache-2.0 原文](spec/licenses/DiffSinger-LICENSE.txt)

ONNX Runtime CPU 库附 MIT 许可与完整第三方通知。早期声码器路线使用的 WORLD 源码及许可原样保留。[ONNX Runtime](frontend/crates/verdant-synthesis/src/neural_ffi/onnxruntime/LICENSE) · [WORLD](frontend/crates/verdant-synthesis/src/neural_ffi/world/LICENSE.txt)

## 前端规格的上游参考

`spec/source-audit/` 保存研究时核对的 Proto-UI 和 GPUI 快照。逐文件 commit、URL 和 SHA-256 见来源表。Verdant 的 Compiler 子集、IR 和工程格式见本项目规格。[来源](spec/SOURCES.md) · [上游许可](spec/licenses/README.md) · [规格](SPEC.md)

## 2021 DV 派生参考

两种解码假设均未确证。复验使用原文件分卷指纹，归属随各输入记录。

## Rust pinyin 字典

前端使用 [mozillazg/rust-pinyin](https://github.com/mozillazg/rust-pinyin) 0.11.0（MIT），其读音数据来自 [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data)。字典提供单字的拼音候选，不代表原声学模型已经恢复或支持这些读音。

两者的 MIT 原文均标注 `Copyright (c) 2016 mozillazg`；下文保留该共同许可原文。固定 crate 的实现与数据随 Cargo 依赖构建使用，未冒充本项目自制字典。原文入口：[rust-pinyin v0.11.0 LICENSE](https://github.com/mozillazg/rust-pinyin/blob/v0.11.0/LICENSE)、[pinyin-data LICENSE](https://github.com/mozillazg/pinyin-data/blob/master/LICENSE)。

The MIT License (MIT)

Copyright (c) 2016 mozillazg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 受乐谱约束的状态时长分配：研究引用

Native 0.4.0 的整数 Gaussian 时长分配为本项目新实现；数学依据引用 Keijiro Saino、Heiga Zen、Yoshihiko Nankaku、Akinobu Lee、Keiichi Tokuda，**An HMM-based Singing Voice Synthesis System**，Interspeech 2006，§2.3，[论文](https://www.isca-archive.org/interspeech_2006/saino06_interspeech.pdf)，DOI [10.21437/Interspeech.2006-584](https://doi.org/10.21437/Interspeech.2006-584)。本项目在固定乐谱边界下最小化状态时长的 Gaussian 负对数似然，没有复制论文代码、训练其 time-lag 模型或声称恢复原商业引擎的时长语义。

声码器、带宽扩展及歌唱对齐的进一步研究归属与采用范围见根目录 `SYNTHESIS-FIDELITY.md`：SiFi-GAN、AP-BWE、LSE/Vocos2D、DiTSinger 等均保留作者来源链接；仅调研的方案不标为已集成能力。

## 发音分析、参数生成与声码器背景：研究引用

以下研究引用同时列在程序的「开源软件与研究引用」独立窗口。论文引用与第三方软件、模型权重的许可分别保留，不把分析参考表述为已恢复的原商业引擎能力。

- Takayoshi Yoshimura、Keiichi Tokuda、Takashi Masuko、Takao Kobayashi、Tadashi Kitamura，**Mixed Excitation for HMM-based Speech Synthesis**，Eurospeech 2001，DOI [10.21437/Eurospeech.2001-539](https://doi.org/10.21437/Eurospeech.2001-539)，[论文](https://www.isca-archive.org/eurospeech_2001/yoshimura01_eurospeech.pdf)。用于激励结构研究；原引擎各频带清浊参数尚未恢复。
- Kuan-Yi Chao、Li-mei Chen，**A Cross-Linguistic Study of Voice Onset Time in Stop Consonant Productions**，CLCLP 13(2)，2008，pp.215–232，[论文](https://aclanthology.org/O08-4005.pdf)。用于跨语言 VOT 分析；没有直接采用论文中的 VOT 常数作为合成参数。
- Keiichi Tokuda、Takayoshi Yoshimura、Takashi Masuko、Takao Kobayashi、Tadashi Kitamura，**Speech parameter generation algorithms for HMM-based speech synthesis**，ICASSP 2000，DOI [10.1109/ICASSP.2000.861820](https://doi.org/10.1109/ICASSP.2000.861820)。现有 MLPG 参数轨迹求解的数学参考；原引擎历史动态窗尚未核实。
- Jungil Kong、Jaehyeon Kim、Jaekyoung Bae，**HiFi-GAN: Generative Adversarial Networks for Efficient and High Fidelity Speech Synthesis**，2020，[论文](https://arxiv.org/abs/2010.05646)。用于声码器架构背景；不声称使用该论文的权重，实际 OpenVPI 权重的许可与官方通知另行保留。
- Masanori Morise、Fumiya Yokomori、Kenji Ozawa，**WORLD: A Vocoder-Based High-Quality Speech Synthesis System for Real-Time Applications**，IEICE E99-D(7)，2016，pp.1877–1884，DOI [10.1587/transinf.2015EDP7457](https://doi.org/10.1587/transinf.2015EDP7457)。作为分析框架参考，pyworld 用于分析诊断；不声称原商业引擎采用 WORLD 合成。
- Malcolm Slaney，**Auditory Toolbox Version 2**，Technical Report 1998-010，[原文入口](https://engineering.purdue.edu/~malcolm/interval/1998-010/)。作为 mel 表示的参考；未随程序打包该工具箱 MATLAB 代码。
- Onur Babacan、Thomas Drugman、Tuomo Raitio、Daniel Erro、Thierry Dutoit，**Parametric Representation for Singing Voice Synthesis: A Comparative Evaluation**，[预印本](https://arxiv.org/abs/2006.04142)。用于比较歌唱参数表示与激励的研究背景，不是本程序音质或可懂度的验收结果。
- Yatharth Sharma，**Fast and Flexible Audio Bandwidth Extension via Vocos**，2026，[预印本](https://arxiv.org/abs/2603.07285)。宽带增强候选，未集成；论文速度数字不代表本机实测性能，也不证明能恢复缺失音素。
- A. E. Rosenberg，**Effect of Glottal Pulse Shape on the Quality of Natural Vowels**，The Journal of the Acoustical Society of America 49(2)，1971，pp.583–590，DOI [10.1121/1.1912389](https://doi.org/10.1121/1.1912389)，[书目信息](https://pubmed.ncbi.nlm.nih.gov/5541751/)。当前 Rosenberg 式声门流导数激励为近似重建，开闭相参数是本项目选择；原 pulse 表尚未恢复，不声称精确复现论文或原商业引擎。


## CFinal：DDSP 方法与训练素材的 credit

CFinal 的条件网络、ONNX 实数 DFT/WOLA 解码器与宿主分块算法由 Verdant 贡献者独立实现。历史实验的作者署名与 SPDX 声明随各自的源文件保留。Rust 生产集成采用仓库的 AGPL-3.0-or-later。

本轮固定预算比较后，主线选择带限 1/k 周期源、可学习的绝对 Hz 声谱滤波与独立滤波噪声；谐波包络模型保留作对照。源滤波实现使用有限窗实数 DFT/WOLA，不是原厂 pulse、GOLF 的 IIR 或官方 CombSub 的复现。两种候选使用各自明确的 ONNX 张量语义合同。

- **Jesse Engel、Lamtharn Hantrakul、Chenjie Gu、Adam Roberts**，*DDSP: Differentiable Digital Signal Processing*，ICLR 2020，[论文](https://arxiv.org/abs/2001.04643)、[Magenta DDSP](https://github.com/magenta/ddsp)。采用可微谐波合成、独立滤波噪声和多尺度波形谱监督这一方法基础；具体网络、绝对 Hz 包络坐标、图与分块算法是本项目实现。
- **yxlllc 及 pc-ddsp / DDSP-SVC 贡献者**，[Pitch Controllable DDSP Vocoders](https://github.com/yxlllc/pc-ddsp)、[DDSP-SVC](https://github.com/yxlllc/DDSP-SVC)。参考音高控制、清浊约束与源滤波设计的比较。本轮简化 source-filter 对照不是官方 CombSub 或 DDSP-SVC 的移植，不把数值结果外推为这些项目的性能结论。
- **Chin-Yun Yu、György Fazekas**，*Singing Voice Synthesis Using Differentiable LPC and Glottal-Flow-Inspired Wavetables*，ISMIR 2023，[论文](https://arxiv.org/abs/2306.17252)、[GOLF](https://github.com/iamycy/golf)。作为声门源、声道与相位建模的候选研究；本轮没有采用其 IIR 解码器或 wavetable 权重。
- **黄亦天 / L8N DEMO 素材制作者**：用户提供的 `L8N DEMO.zip` 内署名与说明，将该素材描述为某商业歌声合成软件的 2010 童声，并说明做过限幅处理。压缩包 SHA-256 为 `74fa274ebc30590d93ac414fda1f539d4c2d8ffc9a0d4e7f6fc3e2ed90b8be2e`。这些是经过处理的参考录音；其来源链和原 sn16k HMM 的来源链分别记录，不声称它们是已经核实的逐样本原引擎输出。语料清单保留全部 403 个 WAV 的指纹、实际解析标签、固定划分与排除原因。

CFinal 研究的原始 TKN、叶统计量、学习权重与参考录音保留各自来源。随包 ONNX 基座按 0.1.0 的角色和 SHA-256 清单分发。本地安装记录原始文件匹配与本地使用声明。[发行](RELEASE.md) · [授权清单](frontend/packaging/verdant-voice/POLICY.json)


## 原生音频设备与 FFP 参数互操作研究

内置效果器、合成器、调制矩阵和 Adwaita 风格界面由 Verdant 独立实现。FabFilter 产品名用于说明功能参照，原厂商标、界面位图、安装包、出厂预设和专有 DSP 不作为本仓库素材分发。官方用户手册为交互与功能定义的研究来源，具体对应与实现边界见[原生插件说明](frontend/docs/NATIVE-PLUGIN-SUITE.md)。

FFP 导入器依据公开格式记录、作者测量的参数表及仅在本地检查的原厂预设结构编写。参数翻译报告保留不可映射内容，不将格式识别或数值翻译表述为音色等价：

- **William Viker**，2026，[rew2fabfilter](https://github.com/willosof/rew2fabfilter)：FFP/Q4 结构研究，含 **Per Ivar Nerseth** 的早期格式工作归属；[MIT 原文](spec/licenses/FFP-rew2fabfilter-MIT.txt)。
- **RaoulDotSH**，2024，[preset-toolkit](https://github.com/raoulsh/preset-toolkit)：Q3 二进制字段研究；[MIT 原文](spec/licenses/FFP-preset-toolkit-MIT.txt)。
- **Per Ivar Nerseth**，2017，[REWEQ2EQPreset](https://github.com/perivar/REWEQ2EQPreset)：早期 FFP 格式研究；[MIT 原文](spec/licenses/FFP-REWEQ2EQPreset-MIT.txt)。
- **phierceweb / logicxkit 贡献者**，[logicxkit](https://github.com/phierceweb/logicxkit)：Q4 与 Pro-MB 的实测参数序号／转换表；[Apache 2.0 原文](spec/licenses/FFP-logicxkit-APACHE-2.0.txt)。

仓库中的预设解析测试使用独立编写的合成数据，不包含商业预设集合。官方样本集合的本地结构检验数量只证明当次解析覆盖，不改变原文件的权利归属，也不构成 FabFilter 兼容性认证。

响度计算参考 [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770) 的 K 加权与节目响度算法，以及 [EBU Tech 3341](https://tech.ebu.ch/docs/tech/tech3341.pdf) 的测量窗口／门限约定。当前是立体声独立实现与校准回归，没有声明取得广播、Dolby Atmos 或其他第三方认证。
