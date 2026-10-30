import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import javax.inject.Inject

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Firebase Analytics, Crashlytics and Remote Config, off until the build has
// app/google-services.json. CI writes it from the GOOGLE_SERVICES_JSON secret
// for the Play bundle only; it is never committed. Without it the plugins
// aren't applied, Firebase never starts and the page sees no analytics bridge.
val firebaseOn = file("google-services.json").exists()
if (firebaseOn) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

// The web game's package.json is the single source of the version number.
val repoRoot: File = rootDir.parentFile
val appVersion = (JsonSlurper().parse(repoRoot.resolve("package.json")) as Map<*, *>)["version"] as String
val versionParts = appVersion.split(".").map { it.toInt() }

// AdMob. Debug builds and the sideloaded APK always use Google's test ids.
// The Play bundle gets the real ones from the environment or Gradle
// properties (CI passes them, from secrets, to the bundle step only).
val testAdmob = mapOf(
    "ADMOB_APP_ID" to "ca-app-pub-3940256099942544~3347511713",
    "ADMOB_REWARDED_ID" to "ca-app-pub-3940256099942544/5224354917",
    "ADMOB_INTERSTITIAL_ID" to "ca-app-pub-3940256099942544/1033173712",
)
fun setting(name: String): String? =
    (System.getenv(name) ?: providers.gradleProperty(name).orNull)?.trim()?.takeIf { it.isNotEmpty() }
val realAdmob = testAdmob.keys.mapNotNull { name -> setting(name)?.let { name to it } }.toMap()
if (realAdmob.isNotEmpty() && realAdmob.size < testAdmob.size) {
    throw GradleException("Set all of ${testAdmob.keys.joinToString()} or none of them; only ${realAdmob.keys.joinToString()} are set.")
}
realAdmob.forEach { (name, id) ->
    val shape = if (name == "ADMOB_APP_ID") Regex("""ca-app-pub-\d+~\d+""") else Regex("""ca-app-pub-\d+/\d+""")
    if (!shape.matches(id)) throw GradleException("$name doesn't look like an AdMob id: $id")
}
val releaseAdmob = testAdmob + realAdmob
// Hashed ids (from logcat) of phones that get test ads and the UMP debug settings.
val testDevices = setting("ADMOB_TEST_DEVICE_IDS").orEmpty()
    .split(",").map { it.trim() }.filter { it.isNotEmpty() }
// Google Play Games, off until the build is given its app id (the numeric
// project id from Play Console). The leaderboard ids are optional, one each.
val playGamesAppId = setting("PLAY_GAMES_APP_ID").orEmpty()
if (playGamesAppId.isNotEmpty() && !Regex("""\d{6,}""").matches(playGamesAppId)) {
    throw GradleException("PLAY_GAMES_APP_ID should be the numeric project id from Play Console, not $playGamesAppId")
}
val playGamesBoards = listOf("STARS", "SEA", "STREAK", "WINS").associateWith { setting("PLAY_GAMES_LEADERBOARD_$it").orEmpty() }
fun quoted(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

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
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.manpreetgugga.boatify"
        minSdk = 26
        targetSdk = 36
        versionCode = versionParts[0] * 10000 + versionParts[1] * 100 + versionParts[2]
        versionName = appVersion
        buildConfigField("String", "ADMOB_TEST_DEVICES", quoted(testDevices.joinToString(",")))
        buildConfigField("String", "PLAY_GAMES_APP_ID", quoted(playGamesAppId))
        buildConfigField("boolean", "FIREBASE", firebaseOn.toString())
        playGamesBoards.forEach { (name, id) -> buildConfigField("String", "PLAY_GAMES_BOARD_$name", quoted(id)) }
        // A string resource, as Play Games wants: a bare number in the manifest would be read as a number.
        resValue("string", "play_games_app_id", playGamesAppId)
    }

    signingConfigs {
        create("release") {
            val storePath = System.getenv("BOATIFY_KEYSTORE_FILE")
            if (!storePath.isNullOrBlank()) {
                // Secrets pasted into GitHub often pick up a trailing line break.
                storeFile = file(storePath)
                storePassword = System.getenv("BOATIFY_KEYSTORE_PASSWORD")?.trimEnd('\r', '\n')
                keyAlias = System.getenv("BOATIFY_KEY_ALIAS")?.trim()
                keyPassword = System.getenv("BOATIFY_KEY_PASSWORD")?.trimEnd('\r', '\n')
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
        debug {
            manifestPlaceholders["admobAppId"] = testAdmob.getValue("ADMOB_APP_ID")
            buildConfigField("String", "ADMOB_REWARDED_ID", quoted(testAdmob.getValue("ADMOB_REWARDED_ID")))
            buildConfigField("String", "ADMOB_INTERSTITIAL_ID", quoted(testAdmob.getValue("ADMOB_INTERSTITIAL_ID")))
        }
        release {
            manifestPlaceholders["admobAppId"] = releaseAdmob.getValue("ADMOB_APP_ID")
            buildConfigField("String", "ADMOB_REWARDED_ID", quoted(releaseAdmob.getValue("ADMOB_REWARDED_ID")))
            buildConfigField("String", "ADMOB_INTERSTITIAL_ID", quoted(releaseAdmob.getValue("ADMOB_INTERSTITIAL_ID")))
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

    buildFeatures {
        buildConfig = true
        resValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
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
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    implementation("com.google.android.play:review:2.0.2")
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.gms:play-services-games-v2:20.1.2")
    implementation(platform("com.google.firebase:firebase-bom:35.1.0"))
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("com.google.firebase:firebase-config")
}
