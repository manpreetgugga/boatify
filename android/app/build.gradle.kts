import groovy.json.JsonSlurper
import javax.inject.Inject

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The web game's package.json is the single source of the version number.
val repoRoot: File = rootDir.parentFile
val appVersion = (JsonSlurper().parse(repoRoot.resolve("package.json")) as Map<*, *>)["version"] as String
val versionParts = appVersion.split(".").map { it.toInt() }

// Bundles web/ into a single index.html with the repo's build script.
abstract class BundleWebTask : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webDir: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val scripts: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val execOps: ExecOperations

    @TaskAction
    fun bundle() {
        val out = outputDir.get().asFile.resolve("www")
        execOps.exec {
            workingDir = webDir.get().asFile.parentFile
            commandLine("node", "scripts/build.mjs", "--out", out.absolutePath)
        }
    }
}

val bundleWeb = tasks.register<BundleWebTask>("bundleWeb") {
    webDir.set(repoRoot.resolve("web"))
    scripts.from(repoRoot.resolve("scripts/build.mjs"), repoRoot.resolve("package.json"))
}

android {
    namespace = "io.github.manpreetgugga.boatify"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.manpreetgugga.boatify"
        minSdk = 26
        targetSdk = 35
        versionCode = versionParts[0] * 10000 + versionParts[1] * 100 + versionParts[2]
        versionName = appVersion
    }

    signingConfigs {
        create("release") {
            val storePath = System.getenv("BOATIFY_KEYSTORE_FILE")
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword = System.getenv("BOATIFY_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BOATIFY_KEY_ALIAS")
                keyPassword = System.getenv("BOATIFY_KEY_PASSWORD")
            } else {
                // Public development key, see keystore/README.md.
                storeFile = rootProject.file("keystore/boatify-dev.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(bundleWeb, BundleWebTask::outputDir)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
