plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "fr.evan.p208"
    compileSdk = 34
    defaultConfig {
        applicationId = "fr.evan.p208"
        minSdk = 26
        targetSdk = 30          // volontairement 30 : moins de restrictions Android sur un autoradio
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes {
        release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("debug") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("webp", "woff", "woff2", "mp4") }
}
dependencies { implementation("androidx.webkit:webkit:1.11.0") }
