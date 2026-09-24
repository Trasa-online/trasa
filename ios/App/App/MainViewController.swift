import UIKit
import Capacitor

// Rejestracja LOKALNYCH pluginow (kod w tym targecie, nie z npm). `packageClassList`
// w capacitor.config.json generuje `cap sync` i wpisuje tam TYLKO paczki z node_modules,
// wiec klasa z tego katalogu bez tej rejestracji nigdy nie trafia do mostu - dokladnie tak
// ScreenshotPlugin lezal martwy od 2026-09-01 (nie byl nawet w projekcie Xcode).
// Storyboard (Main.storyboard) wskazuje te klase jako kontroler WebView.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(InstagramStoriesPlugin())
        bridge?.registerPluginInstance(ScreenshotPlugin())
    }
}
