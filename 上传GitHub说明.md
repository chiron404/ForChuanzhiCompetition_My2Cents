# 将蓝图 Blueprint 上传到 GitHub

这个文件夹已经是完整 Git 仓库，包含源码和比赛报告。隐藏的 `.git` 保存真实提交历史，请保留。应用无需依赖原电脑的其他项目目录；首次运行需联网安装依赖。GitHub 公开仓库已创建；此本地副本尚未绑定远端，本次资料更新没有执行推送。

## 1. 先检查报名信息

已填写学校马鞍山学院、专业软件工程、团队 My2Cents、成员韩志伟和杜鹏辉、指导老师刘东旭。参赛组别为 B组，GitHub 仓库地址已填写。正式提交前核对 [README](README.md)、[团队表](docs/参赛材料/团队与链接信息.md) 及报告。视频成片单独提交。

## 2. 使用已创建的 GitHub 仓库

仓库：[chiron404/ForChuanzhiCompetition_My2Cents](https://github.com/chiron404/ForChuanzhiCompetition_My2Cents)。已核实为 Public（公开）。克隆地址为 `https://github.com/chiron404/ForChuanzhiCompetition_My2Cents.git`，无需另建仓库。推送后再核验源码、报告和完整提交历史是否已在远端显示。

## 3. 推送本文件夹的现有历史

在此文件夹打开 PowerShell，执行下面命令。命令已填入实际仓库地址。

```powershell
git status
git log --oneline
git remote add origin https://github.com/chiron404/ForChuanzhiCompetition_My2Cents.git
git push -u origin main
```

按 Git 的登录提示完成自己账号的认证，不要把密码或访问令牌粘贴到 README、代码、环境模板或公开讨论中。如果 `origin` 已存在，先用 `git remote -v` 核对；确需更换时使用 `git remote set-url origin 实际仓库地址`。不要使用强制推送覆盖一个已有项目。

本目录已经初始化并提交，无需再次 `git init`，也无需创建“首次提交”。使用 Git 推送可保留原开发历史。仅把文件拖到 GitHub 网页不会上传本地 `.git` 中的提交记录，因此不适合本次保留历史的要求。

## 4. 后续更新资料

在文件夹中修改 README、团队信息和报告后，先检查差异，再提交并推送：

```powershell
git diff
git add README.md docs/参赛材料
git commit -m "docs: 更新参赛材料"
git push
```

如果 Git 提示缺少提交身份，在这个仓库内设置自己的姓名与邮箱，然后重新提交。保持原来的开发记录；新增提交使用实际操作者的信息。

## 5. 上传后检查

- 仓库首页正常显示中文介绍和界面图片。
- 提交历史包含原两次开发提交及后续材料整理、团队信息更新提交。
- `docs/参赛材料/01 蓝图Blueprint 技术报告.pdf` 能打开或下载，技术报告仍不超过 30 页。
- `.env.example` 的密钥为空，没有 `.env.local`、依赖目录或原始大体积录屏。
- 评审能访问仓库；视频按比赛入口另行提交。

可视化操作也可使用 GitHub Desktop 添加本文件夹为已有仓库，再发布。具体入口以软件实际界面为准。

参考：[GitHub 官方：将本地代码添加到 GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。
