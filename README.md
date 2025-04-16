###NOTE### firebaseConfig.js and google-service.json not included

npm install

npx react-native run-android

If some of the libraries make trouble 
go -> node_modules/specificlibrary/android/build.gradle

Add this line 
    buildFeatures {
        buildConfig true
    }
    
in to the files *android{}* block.
Also, if the same library makes trouble again, add their namespace in *android{}* block again if it doesn't exist already.
