import Foundation
import Capacitor
import UIKit

// Wykrywanie ZRZUTU EKRANU (prosba Nat 2026-09-01). iOS nie daje tego WebView - system wysyla
// `userDidTakeScreenshotNotification` tylko do warstwy natywnej, wiec potrzebny jest ten most.
//
// Po co: karta do udostepnienia (ShareCard) ma pokazywac sie DOKLADNIE wtedy, gdy user probuje
// zrobic zrzut ekranu - tak jak na Pintereście. Zamiast szukac guzika "Udostepnij", robi to,
// co i tak chcial zrobic, a aplikacja podaje mu ladny kadr.
//
// UWAGA: iOS nie pozwala PRZECHWYCIC zrzutu ani go podmienic - zdjecie, ktore user wlasnie
// zrobil, zostaje takie, jakie bylo. Dostajemy tylko sygnal "zrzut sie wydarzyl", wiec karta
// pojawia sie PO nim i user robi drugi zrzut, juz z karta. Tak samo dziala Pinterest.
@objc(ScreenshotPlugin)
public class ScreenshotPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenshotPlugin"
    public let jsName = "Screenshot"
    public let pluginMethods: [CAPPluginMethod] = []

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didTakeScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
    }

    @objc func didTakeScreenshot() {
        // Nazwa zdarzenia lustrzana do tej, ktorej nasluchuje useScreenshot() po stronie JS.
        notifyListeners("screenshotTaken", data: [:])
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
