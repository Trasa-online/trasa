import Foundation
import Capacitor
import UIKit

// UDOSTEPNIANIE DO INSTAGRAM STORIES (prosba Nat 2026-09-21). Instagram nie ma zadnego API na
// link w relacji - jedyne, co apka zewnetrzna moze mu przekazac, to OBRAZ TLA, OBRAZ NAKLEJKI
// i dwa kolory tla, przez schowek + `instagram-stories://share?source_application=<fb app id>`
// (dokumentacja Meta „Sharing to Stories"; dawny link atrybucji `contentURL` zostal wycofany).
//
// Dlatego LINK do miejsca laduje w tym samym wpisie schowka jako zwykly tekst: Instagram bierze
// z wpisu swoje klucze `com.instagram.sharedSticker.*`, a user w edytorze relacji tapa naklejke
// „Link" i WKLEJA - schowek jest juz pelny. Po kilku sekundach schowek dostaje SAM tekst linku
// (bez obrazow), zeby „Wklej" w innych aplikacjach nie proponowalo pliku graficznego.
//
// `source_application` = Facebook App ID (bez niego nowe wersje Instagrama ignoruja wywolanie).
// Wartosc przychodzi z JS (`VITE_FACEBOOK_APP_ID`), wiec jej zmiana nie wymaga zmian tutaj.
@objc(InstagramStoriesPlugin)
public class InstagramStoriesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InstagramStoriesPlugin"
    public let jsName = "InstagramStories"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canShare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copy", returnType: CAPPluginReturnPromise),
    ]

    /// Link do schowka - z natywki, bo `navigator.clipboard.writeText` w WKWebView dziala
    /// tylko w gescie usera, a arkusz kopiuje po renderze obrazu (kilkaset ms pozniej).
    @objc func copy(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.isEmpty else { call.reject("missing_text"); return }
        DispatchQueue.main.async {
            UIPasteboard.general.string = text
            call.resolve()
        }
    }

    private static let storiesURL = URL(string: "instagram-stories://share")!

    @objc func canShare(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Wymaga `instagram-stories` w LSApplicationQueriesSchemes (Info.plist).
            call.resolve(["available": UIApplication.shared.canOpenURL(Self.storiesURL)])
        }
    }

    @objc func share(_ call: CAPPluginCall) {
        guard let appId = call.getString("appId"), !appId.isEmpty else {
            call.reject("missing_app_id"); return
        }
        var item: [String: Any] = [:]
        if let s = call.getString("stickerImage"), let data = Data(base64Encoded: s, options: .ignoreUnknownCharacters) {
            item["com.instagram.sharedSticker.stickerImage"] = data
        }
        if let b = call.getString("backgroundImage"), let data = Data(base64Encoded: b, options: .ignoreUnknownCharacters) {
            item["com.instagram.sharedSticker.backgroundImage"] = data
        }
        if let top = call.getString("backgroundTopColor") { item["com.instagram.sharedSticker.backgroundTopColor"] = top }
        if let bottom = call.getString("backgroundBottomColor") { item["com.instagram.sharedSticker.backgroundBottomColor"] = bottom }
        if item.isEmpty { call.reject("nothing_to_share"); return }
        let link = call.getString("link")
        if let link = link, !link.isEmpty {
            // Ten sam wpis schowka niesie tez link jako tekst - do naklejki „Link" w edytorze.
            item["public.utf8-plain-text"] = link
        }

        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(Self.storiesURL) else {
                call.resolve(["opened": false, "reason": "unavailable"]); return
            }
            let expires = Date().addingTimeInterval(60 * 5)
            UIPasteboard.general.setItems([item], options: [.expirationDate: expires])
            var comps = URLComponents(string: "instagram-stories://share")!
            comps.queryItems = [URLQueryItem(name: "source_application", value: appId)]
            guard let url = comps.url else { call.reject("bad_url"); return }
            UIApplication.shared.open(url, options: [:]) { ok in
                call.resolve(["opened": ok])
                guard ok, let link = link, !link.isEmpty else { return }
                // Instagram czyta schowek od razu przy otwarciu. Po chwili zostawiamy w nim SAM
                // link - zadanie w tle, bo apka jest juz za Instagramem i iOS moglby ja uspic.
                var task = UIBackgroundTaskIdentifier.invalid
                task = UIApplication.shared.beginBackgroundTask { UIApplication.shared.endBackgroundTask(task) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
                    UIPasteboard.general.string = link
                    if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
                }
            }
        }
    }
}
