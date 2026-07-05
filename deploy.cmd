@echo off
rem 하나비 GitHub Pages 배포 스크립트: 빌드 후 gh-pages 브랜치로 푸시
set PATH=C:\Users\cala1\dev\node;C:\Users\cala1\dev\gh;%PATH%
cd /d C:\Users\cala1\dev\hanabi
set DEPLOY=1
call npm run build || exit /b 1
copy /y dist\index.html dist\404.html >nul
cd dist
if exist .git rmdir /s /q .git
git init -b gh-pages >nul
git add -A
git commit -q -m "deploy"
git push -f https://github.com/oreo4885-max/hanabi.git gh-pages
cd ..
rmdir /s /q dist\.git
echo 배포 완료: https://oreo4885-max.github.io/hanabi/
