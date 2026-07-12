@echo off
echo Creating images folder...
mkdir "c:\Users\USER\Desktop\speccheck\frontend\public\images" 2>nul
echo Copying wallpapers...
copy "C:\Users\USER\.gemini\antigravity\brain\79de752b-37e8-4213-9839-1438938177a9\media__1783241437300.jpg" "c:\Users\USER\Desktop\speccheck\frontend\public\images\image1.jpg" /Y
copy "C:\Users\USER\.gemini\antigravity\brain\79de752b-37e8-4213-9839-1438938177a9\media__1783241437405.jpg" "c:\Users\USER\Desktop\speccheck\frontend\public\images\image2.jpg" /Y
echo Done! Wallpapers copied successfully to frontend/public/images/
pause
