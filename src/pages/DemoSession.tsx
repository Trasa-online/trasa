import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Sparkles, Users, User, Copy, Check, Loader2 } from "lucide-react";
import { SwipeCard } from "@/components/plan-wizard/PlaceSwiper";
import type { MockPlace, PlaceCategory } from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getDeviceId(): string {
  let id = localStorage.getItem("trasa_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("trasa_device_id", id);
  }
  return id;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

interface DemoPlace {
  id: string;
  name: string;
  photo: string;
  rating: number;
  address: string;
  tags: string[];
  description: string;
}

const PHOTOS = {
  cafe: [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&q=80",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    "https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=600&q=80",
    "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80",
    "https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=600&q=80",
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80",
    "https://images.unsplash.com/photo-1507914997125-87b4a32a4f96?w=600&q=80",
  ],
  restaurant: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
    "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80",
    "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&q=80",
    "https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=600&q=80",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=600&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80",
  ],
  bar: [
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80",
    "https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=600&q=80",
    "https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=600&q=80",
    "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=600&q=80",
    "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80",
    "https://images.unsplash.com/photo-1560512823-829485b8bf24?w=600&q=80",
    "https://images.unsplash.com/photo-1514362453360-8f94243c9996?w=600&q=80",
    "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  ],
  museum: [
    "https://images.unsplash.com/photo-1503891450247-ee5f8ec46dc3?w=600&q=80",
    "https://images.unsplash.com/photo-1564399580075-5dfe19c205f3?w=600&q=80",
    "https://images.unsplash.com/photo-1605265073900-27dd6ae27fb9?w=600&q=80",
    "https://images.unsplash.com/photo-1580136579312-94651dfd596d?w=600&q=80",
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=80",
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80",
    "https://images.unsplash.com/photo-1572953109213-3be62398eb95?w=600&q=80",
    "https://images.unsplash.com/photo-1516916759473-600c07bc12d4?w=600&q=80",
  ],
  park: [
    "https://images.unsplash.com/photo-1519197924294-4ba991a11128?w=600&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80",
    "https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=600&q=80",
    "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=600&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
    "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80",
  ],
  experience: [
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80",
    "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&q=80",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80",
    "https://images.unsplash.com/photo-1544985361-b420d7a77043?w=600&q=80",
    "https://images.unsplash.com/photo-1551818255-e6e10975bc17?w=600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80",
  ],
};

type CategoryKey = keyof typeof MOCK_DATA["Kraków"];

const MOCK_DATA: Record<string, Record<string, DemoPlace[]>> = {
  Kraków: {
    cafe: [
      { id: "k-c1", name: "Kawiarnia Płyś", photo: PHOTOS.cafe[0], rating: 4.8, address: "ul. Floriańska 26", tags: ["specialty coffee", "klimatyczna"], description: "Kultowa kawiarnia w sercu Krakowa, znana z doskonałej kawy i wyjątkowej atmosfery." },
      { id: "k-c2", name: "Cafe Camelot", photo: PHOTOS.cafe[1], rating: 4.7, address: "ul. Świętego Tomasza 17", tags: ["klimatyczna", "desery"], description: "Magiczne miejsce ze średniowiecznym klimatem, pyszne desery i herbaty." },
      { id: "k-c3", name: "Kawa i Wawa", photo: PHOTOS.cafe[2], rating: 4.6, address: "ul. Józefa 9", tags: ["specialty coffee", "Kazimierz"], description: "Mała, przytulna kawiarnia na Kazimierzu z doskonałą kawą speciality." },
      { id: "k-c4", name: "Blossom Cafe", photo: PHOTOS.cafe[3], rating: 4.5, address: "ul. Karmelicka 14", tags: ["śniadania", "zdrowe"], description: "Kawiarnia z pysznymi śniadaniami i wegańskim menu, idealna na poranek." },
      { id: "k-c5", name: "Boccanera", photo: PHOTOS.cafe[4], rating: 4.9, address: "ul. Bracka 4", tags: ["espresso", "włoska"], description: "Najlepsza włoska espresso w Krakowie. Proste, perfekcyjne, bez kompromisów." },
      { id: "k-c6", name: "Karma Coffee", photo: PHOTOS.cafe[5], rating: 4.6, address: "ul. Szewska 6", tags: ["specialty", "hipsterska"], description: "Jeden z pionierów specialty coffee w Krakowie." },
      { id: "k-c7", name: "Café Hamlet", photo: PHOTOS.cafe[6], rating: 4.4, address: "Plac Mariacki 5", tags: ["klasyczna", "centrum"], description: "Klasyczna wiedeńska kawiarnia z widokiem na Plac Mariacki." },
      { id: "k-c8", name: "Drukarnia Cafe", photo: PHOTOS.cafe[7], rating: 4.5, address: "ul. Nadwiślańska 1", tags: ["industrialna", "rzeka"], description: "Oryginalna drukarnia przemieniona w kultowe miejsce nad Wisłą." },
    ],
    restaurant: [
      { id: "k-r1", name: "Restauracja Miód Malina", photo: PHOTOS.restaurant[0], rating: 4.7, address: "ul. Grodzka 40", tags: ["polska", "fine dining"], description: "Wyrafinowana kuchnia polska w eleganckim wnętrzu przy ul. Grodzkiej." },
      { id: "k-r2", name: "Pod Nosem", photo: PHOTOS.restaurant[1], rating: 4.8, address: "ul. Kanonicza 22", tags: ["polska", "wino"], description: "Wyjątkowa restauracja z widokiem na Wawel i świetną kartą win." },
      { id: "k-r3", name: "Trzy Rybki", photo: PHOTOS.restaurant[2], rating: 4.6, address: "ul. Szczepańska 5", tags: ["ryby", "owoce morza"], description: "Najlepsza restauracja rybna w Krakowie z codziennie świeżymi dostawami." },
      { id: "k-r4", name: "Biała Różyczka", photo: PHOTOS.restaurant[3], rating: 4.5, address: "ul. Bracka 20", tags: ["polska", "klimatyczna"], description: "Tradycyjna polska kuchnia w pięknej kamienicy." },
      { id: "k-r5", name: "CroQodil", photo: PHOTOS.restaurant[4], rating: 4.4, address: "ul. Wiedeńska 3", tags: ["fusion", "nowoczesna"], description: "Kreatywna kuchnia fusion łącząca tradycję z nowoczesnością." },
      { id: "k-r6", name: "Szara Gęś", photo: PHOTOS.restaurant[5], rating: 4.7, address: "Rynek Główny 17", tags: ["premium", "rynek"], description: "Elegancka restauracja z tarasem z widokiem na Rynek Główny." },
      { id: "k-r7", name: "Vegab", photo: PHOTOS.restaurant[6], rating: 4.6, address: "ul. Bożego Ciała 15", tags: ["wegańska", "Kazimierz"], description: "Najlepsza wegańska kuchnia na Kazimierzu." },
      { id: "k-r8", name: "Momo", photo: PHOTOS.restaurant[7], rating: 4.8, address: "ul. Dominikańska 3", tags: ["wegetariańska", "azjatycka"], description: "Kultowe wegetariańskie tybetańskie pierożki momo." },
    ],
    bar: [
      { id: "k-b1", name: "Alchemia", photo: PHOTOS.bar[0], rating: 4.6, address: "ul. Estery 5", tags: ["klimatyczny", "Kazimierz"], description: "Legendarny bar na Kazimierzu z niepowtarzalną atmosferą." },
      { id: "k-b2", name: "Singer", photo: PHOTOS.bar[1], rating: 4.5, address: "ul. Estery 20", tags: ["maszyny Singer", "klimatyczny"], description: "Bar słynący z maszyn do szycia Singer jako stolików — ikona Kazimierza." },
      { id: "k-b3", name: "Pauza", photo: PHOTOS.bar[2], rating: 4.4, address: "ul. Floriańska 18", tags: ["artystyczny", "koktajle"], description: "Bar z galerią sztuki, słynny z autorskich koktajli." },
      { id: "k-b4", name: "Forum Przestrzenie", photo: PHOTOS.bar[3], rating: 4.7, address: "ul. Konopnickiej 28", tags: ["widok na Wawel", "rzeka"], description: "Kultowy bar w starym hotelu Forum z tarasem nad Wisłą." },
      { id: "k-b5", name: "Rdza", photo: PHOTOS.bar[4], rating: 4.3, address: "ul. Józefińska 9", tags: ["craft beer", "industrialny"], description: "Bar z rzemieślniczym piwem w industrialnym wnętrzu." },
      { id: "k-b6", name: "Kolanko No 6", photo: PHOTOS.bar[5], rating: 4.5, address: "ul. Józefa 17", tags: ["winny", "intymny"], description: "Mały przytulny bar winny w samym sercu Kazimierza." },
      { id: "k-b7", name: "Propaganda", photo: PHOTOS.bar[6], rating: 4.4, address: "ul. Miodowa 20", tags: ["PRL", "nostalgiczny"], description: "Bar w stylu PRL-u, kolekcja socjalistycznych gadżetów." },
      { id: "k-b8", name: "Szafe", photo: PHOTOS.bar[7], rating: 4.3, address: "ul. Felicjanek 10", tags: ["LGBT+", "przyjazny"], description: "Przyjazny, otwarty bar z dobrą muzyką i koktajlami." },
    ],
    museum: [
      { id: "k-m1", name: "Wawel", photo: PHOTOS.museum[0], rating: 4.9, address: "Wawel 5", tags: ["historia", "zamek"], description: "Symbol Polski — zamek królewski na wzgórzu wawelskim z katedrą i smoczą jamą." },
      { id: "k-m2", name: "MOCAK", photo: PHOTOS.museum[1], rating: 4.6, address: "ul. Lipowa 4", tags: ["sztuka współczesna", "Kazimierz"], description: "Muzeum Sztuki Współczesnej w Krakowie w dawnej fabryce Schindlera." },
      { id: "k-m3", name: "Muzeum Manggha", photo: PHOTOS.museum[2], rating: 4.7, address: "ul. Marii Konopnickiej 26", tags: ["japońskie", "rzeka"], description: "Muzeum Sztuki i Techniki Japońskiej z widokiem na Wawel." },
      { id: "k-m4", name: "Fabryka Schindlera", photo: PHOTOS.museum[3], rating: 4.8, address: "ul. Lipowa 4", tags: ["II WŚ", "historia"], description: "Poruszające muzeum w autentycznej fabryce z czasów II wojny światowej." },
      { id: "k-m5", name: "Muzeum Narodowe", photo: PHOTOS.museum[4], rating: 4.5, address: "al. 3 Maja 1", tags: ["sztuka", "kolekcje"], description: "Największe muzeum w Małopolsce z kolekcjami od średniowiecza po współczesność." },
      { id: "k-m6", name: "Cricoteka", photo: PHOTOS.museum[5], rating: 4.6, address: "ul. Nadwiślańska 2", tags: ["teatr", "awangarda"], description: "Centrum dokumentacji teatru Tadeusza Kantora z widokiem na Wisłę." },
      { id: "k-m7", name: "Muzeum Czartoryskich", photo: PHOTOS.museum[6], rating: 4.7, address: "ul. Pijarska 15", tags: ["Dama z gronostajem", "klasyczne"], description: "Dom Damy z gronostajem Leonarda da Vinci — jedno z najcenniejszych dzieł w Polsce." },
      { id: "k-m8", name: "Stary Teatr", photo: PHOTOS.museum[7], rating: 4.6, address: "ul. Jagiellońska 1", tags: ["teatr", "historia"], description: "Jeden z najstarszych teatrów w Polsce w przepięknym budynku." },
    ],
    park: [
      { id: "k-p1", name: "Planty", photo: PHOTOS.park[0], rating: 4.8, address: "Planty, Kraków", tags: ["spacer", "centrum"], description: "Pierścień zieleni otaczający Stare Miasto — idealne na spacer." },
      { id: "k-p2", name: "Błonia", photo: PHOTOS.park[1], rating: 4.7, address: "al. Focha", tags: ["rozległy", "piknik"], description: "Rozległe łąki w centrum Krakowa, miejsce papieskich mszy i pikników." },
      { id: "k-p3", name: "Park Jordana", photo: PHOTOS.park[2], rating: 4.5, address: "al. 3 Maja", tags: ["rodzinny", "sport"], description: "Zabytkowy park z fontanną, idealne dla rodzin z dziećmi." },
      { id: "k-p4", name: "Las Wolski", photo: PHOTOS.park[3], rating: 4.8, address: "al. Kasy Oszczędności Miasta Krakowa", tags: ["natura", "las"], description: "Zielone płuca Krakowa z zoo i licznymi trasami spacerowymi." },
      { id: "k-p5", name: "Wzgórze Krzemionki", photo: PHOTOS.park[4], rating: 4.6, address: "ul. Zamenhoffa", tags: ["widok", "panorama"], description: "Najpiękniejszy widok na panoramę Krakowa i Wawel." },
      { id: "k-p6", name: "Ogród Botaniczny UJ", photo: PHOTOS.park[5], rating: 4.6, address: "ul. Kopernika 27", tags: ["botaniczny", "cichy"], description: "Najstarszy ogród botaniczny w Polsce, spokojne miejsce na refleksję." },
      { id: "k-p7", name: "Park Decjusza", photo: PHOTOS.park[6], rating: 4.5, address: "ul. 28 Lipca 1943", tags: ["renesansowy", "zabytkowy"], description: "Renesansowy park przy willi Decjusza z fontannami." },
      { id: "k-p8", name: "Bulwary Wiślane", photo: PHOTOS.park[7], rating: 4.7, address: "Bulwar Czerwieński", tags: ["rzeka", "rowery"], description: "Nadwiślańskie bulwary — idealne na bieganie, rowery i wieczorne spacery." },
    ],
    experience: [
      { id: "k-e1", name: "Podziemia Rynku", photo: PHOTOS.experience[0], rating: 4.7, address: "Rynek Główny 1", tags: ["historia", "podziemia"], description: "Interaktywne muzeum pod Rynkiem Głównym — podróż przez średniowieczny Kraków." },
      { id: "k-e2", name: "Dragon's Den", photo: PHOTOS.experience[1], rating: 4.6, address: "Wzgórze Wawelskie", tags: ["legenda", "smok"], description: "Legendarna smocza jama pod Wawelem — ikona krakowskich legend." },
      { id: "k-e3", name: "Rejs statkiem po Wiśle", photo: PHOTOS.experience[2], rating: 4.5, address: "Bulwar Czerwieński", tags: ["rejs", "widoki"], description: "Romantyczny rejs po Wiśle z widokiem na Wawel i panoramę miasta." },
      { id: "k-e4", name: "Escape Room Labirynt", photo: PHOTOS.experience[3], rating: 4.8, address: "ul. Szpitalna 38", tags: ["escape room", "przygoda"], description: "Najlepiej oceniany escape room w Krakowie — zagadki w klimatycznych sceneriach." },
      { id: "k-e5", name: "Kino Pod Baranami", photo: PHOTOS.experience[4], rating: 4.7, address: "Rynek Główny 27", tags: ["kino", "kultowe"], description: "Kultowe kino studyjne na Rynku Głównym." },
      { id: "k-e6", name: "Jazz Club u Muniaka", photo: PHOTOS.experience[5], rating: 4.8, address: "ul. Floriańska 3", tags: ["jazz", "muzyka na żywo"], description: "Legendarny jazz club — najlepsza muzyka na żywo w Krakowie." },
      { id: "k-e7", name: "Ścieżka na Kopiec Kościuszki", photo: PHOTOS.experience[6], rating: 4.7, address: "al. Jerzego Waszyngtona 1", tags: ["panorama", "aktywny"], description: "Wycieczka na Kopiec Kościuszki z panoramą całego Krakowa." },
      { id: "k-e8", name: "Żywa Szachownica", photo: PHOTOS.experience[7], rating: 4.4, address: "Rynek Główny", tags: ["gry", "uliczny"], description: "Wielka szachownica na Rynku Głównym — zagraj żywymi pionkami." },
    ],
  },
  Gdańsk: {
    cafe: [
      { id: "g-c1", name: "Balans Coffee", photo: PHOTOS.cafe[0], rating: 4.8, address: "ul. Długa 52", tags: ["specialty coffee", "śniadania"], description: "Jeden z najlepszych barów kawowych w Gdańsku ze świeżo palonymi ziarnami." },
      { id: "g-c2", name: "Kawiarnia Drukarnia", photo: PHOTOS.cafe[1], rating: 4.6, address: "ul. Szafarnia 9", tags: ["klimatyczna", "vintage"], description: "Stara drukarnia zamieniona w urokliwe miejsce spotkań." },
      { id: "g-c3", name: "Plenum", photo: PHOTOS.cafe[2], rating: 4.7, address: "ul. Tkacka 12", tags: ["specialty coffee", "design"], description: "Minimalistyczna kawiarnia z doskonałą kawą speciality." },
      { id: "g-c4", name: "Józef K.", photo: PHOTOS.cafe[3], rating: 4.6, address: "ul. Piwna 1", tags: ["literacka", "klimatyczna"], description: "Kawiarnia inspirowana prozą Kafki w sercu Starego Miasta." },
      { id: "g-c5", name: "Fika", photo: PHOTOS.cafe[4], rating: 4.5, address: "ul. Długi Targ 39", tags: ["skandynawska", "ciasta"], description: "Szwedzka koncepcja fiki — kawa i ciasto jako rytuał dnia." },
      { id: "g-c6", name: "MOYA MATCHA", photo: PHOTOS.cafe[5], rating: 4.4, address: "ul. Mariacka 31", tags: ["matcha", "zdrowe"], description: "Urocza kawiarnia przy ul. Mariackiej specjalizująca się w matcha latte." },
      { id: "g-c7", name: "Leń", photo: PHOTOS.cafe[6], rating: 4.5, address: "ul. Korzenna 33", tags: ["relaks", "slow"], description: "Kawiarnia dla tych, którzy chcą zwolnić tempo." },
      { id: "g-c8", name: "Perro Negro Kaffe", photo: PHOTOS.cafe[7], rating: 4.7, address: "ul. Wały Piastowskie 24", tags: ["specialty", "minimalizm"], description: "Czarne espresso i minimalistyczny design — perfekcja w każdym łyku." },
    ],
    restaurant: [
      { id: "g-r1", name: "Targ Rybny Fishmarkt", photo: PHOTOS.restaurant[0], rating: 4.7, address: "ul. Targ Rybny 6", tags: ["ryby", "historyczna"], description: "Restauracja rybna w zabytkowym targu rybnym nad Motławą." },
      { id: "g-r2", name: "Goldwasser", photo: PHOTOS.restaurant[1], rating: 4.6, address: "ul. Długie Pobrzeże 22", tags: ["polska", "premium"], description: "Elegancka restauracja polska z widokiem na Motławę." },
      { id: "g-r3", name: "Ostro", photo: PHOTOS.restaurant[2], rating: 4.8, address: "ul. Straganiarska 2", tags: ["owoce morza", "ryby"], description: "Świeże owoce morza i ryby — najlepsza rybna w mieście." },
      { id: "g-r4", name: "Calma Pasta Fresca", photo: PHOTOS.restaurant[3], rating: 4.7, address: "ul. Ogarna 37", tags: ["włoska", "pasta"], description: "Świeżo robiona pasta i włoski klimat w centrum Gdańska." },
      { id: "g-r5", name: "Literacka Restaurant", photo: PHOTOS.restaurant[4], rating: 4.8, address: "ul. Długa 62", tags: ["fine dining", "wino"], description: "Fine dining z doskonałą kartą win w zabytkowej kamienicy." },
      { id: "g-r6", name: "Pan Papuga", photo: PHOTOS.restaurant[5], rating: 4.5, address: "ul. Piwna 28", tags: ["polska", "klimatyczna"], description: "Polska kuchnia w pięknej klimatycznej restauracji przy ul. Piwnej." },
      { id: "g-r7", name: "MONTOWNIA Food Hall", photo: PHOTOS.restaurant[6], rating: 4.6, address: "ul. Targ Drzewny 4", tags: ["food hall", "różnorodna"], description: "Gdańska hala food court z kuchnią z całego świata." },
      { id: "g-r8", name: "Durga", photo: PHOTOS.restaurant[7], rating: 4.4, address: "ul. Podwale Staromiejskie 51", tags: ["indyjska", "egzotyczna"], description: "Autentyczna kuchnia indyjska w niepozornym lokalu." },
    ],
    bar: [
      { id: "g-b1", name: "SASSY Rooftop Bar", photo: PHOTOS.bar[0], rating: 4.7, address: "ul. Toruńska 12", tags: ["rooftop", "widok"], description: "Najpiękniejszy widok na Gdańsk z drinka w ręce." },
      { id: "g-b2", name: "Fibonacci Aperitivo", photo: PHOTOS.bar[1], rating: 4.6, address: "ul. Długa 14", tags: ["aperitivo", "włoski styl"], description: "Włoski aperitivo bar z doskonałymi spritzami." },
      { id: "g-b3", name: "UWAGA PIWO Piwna", photo: PHOTOS.bar[2], rating: 4.5, address: "ul. Piwna 60", tags: ["craft beer", "rzemieślnicze"], description: "Craft beer bar z imponującą selekcją polskich piw rzemieślniczych." },
      { id: "g-b4", name: "Bar Leon", photo: PHOTOS.bar[3], rating: 4.4, address: "ul. Lawendowa 9", tags: ["koktajle", "klimatyczny"], description: "Mały bar koktajlowy z wielką osobowością." },
      { id: "g-b5", name: "Smoki i Lochy", photo: PHOTOS.bar[4], rating: 4.6, address: "ul. Ogarna 43", tags: ["planszówki", "pub"], description: "Pub z planszówkami — idealne na wieczór z przyjaciółmi." },
      { id: "g-b6", name: "Irish Pub Piwnica", photo: PHOTOS.bar[5], rating: 4.3, address: "ul. Długa 47", tags: ["irish", "piwo"], description: "Autentyczny irlandzki pub z piwem Guinness i meczami na żywo." },
      { id: "g-b7", name: "El Mariachi", photo: PHOTOS.bar[6], rating: 4.5, address: "ul. Szeroka 76", tags: ["tequila", "meksykański"], description: "Meksykański bar z tequilą i nachos — fiesta w centrum Gdańska." },
      { id: "g-b8", name: "No To Cyk", photo: PHOTOS.bar[7], rating: 4.4, address: "ul. Chlebnicka 12", tags: ["lokalne", "casual"], description: "Lokalny bar bez pretensji — dobre piwo i dobra atmosfera." },
    ],
    museum: [
      { id: "g-m1", name: "Muzeum II Wojny Światowej", photo: PHOTOS.museum[0], rating: 4.9, address: "pl. Władysława Bartoszewskiego 1", tags: ["II WŚ", "historia"], description: "Jedno z najważniejszych muzeów na świecie — historia II wojny widziana z Gdańska." },
      { id: "g-m2", name: "ECS Solidarności", photo: PHOTOS.museum[1], rating: 4.8, address: "pl. Solidarności 1", tags: ["Solidarność", "historia"], description: "Centrum dokumentujące historię Solidarności i początki wolności w Polsce." },
      { id: "g-m3", name: "Muzeum Bursztynu", photo: PHOTOS.museum[2], rating: 4.6, address: "ul. Targ Węglowy 26", tags: ["bursztyn", "unikat"], description: "Fascynująca kolekcja bursztynu bałtyckiego — złoto Bałtyku." },
      { id: "g-m4", name: "Muzeum Morskie", photo: PHOTOS.museum[3], rating: 4.5, address: "ul. Ołowianka 9", tags: ["morze", "statki"], description: "Historia żeglugi i Bałtyku na wyspie Ołowianka." },
      { id: "g-m5", name: "Hevelianum", photo: PHOTOS.museum[4], rating: 4.6, address: "ul. Gradowa 6", tags: ["nauka", "interaktywne"], description: "Centrum nauki na Górze Gradowej z interaktywnymi eksponatami." },
      { id: "g-m6", name: "Ratusz Głównego Miasta", photo: PHOTOS.museum[5], rating: 4.7, address: "ul. Długa 46", tags: ["architektura", "historia"], description: "Gotycki ratusz z Salą Czerwoną i niezapomnianym widokiem z wieży." },
      { id: "g-m7", name: "Twierdza Wisłoujście", photo: PHOTOS.museum[6], rating: 4.5, address: "ul. Stara Twierdza 1", tags: ["twierdza", "historia"], description: "XVI-wieczna twierdza przy ujściu Wisły — niesamowita architektura obronna." },
      { id: "g-m8", name: "Muzeum Arcade", photo: PHOTOS.museum[7], rating: 4.4, address: "ul. Rajska 10", tags: ["gry", "retro"], description: "Muzeum gier wideo z setkami działających automatów arcade." },
    ],
    park: [
      { id: "g-p1", name: "Park Oliwski", photo: PHOTOS.park[0], rating: 4.9, address: "ul. Opata Jacka Rybińskiego 1", tags: ["ogród botaniczny", "katedra"], description: "Jeden z najpiękniejszych parków w Polsce przy Katedrze Oliwskiej." },
      { id: "g-p2", name: "Góra Gradowa", photo: PHOTOS.park[1], rating: 4.6, address: "ul. Gradowa 6", tags: ["widok", "wzgórze"], description: "Wzgórze z panoramą starego miasta i Długiego Pobrzeża." },
      { id: "g-p3", name: "Park Hevelianum", photo: PHOTOS.park[2], rating: 4.5, address: "ul. Gradowa", tags: ["park", "spacer"], description: "Park łączący historię z rekreacją, otaczający Hevelianum." },
      { id: "g-p4", name: "Plaża Brzeźno", photo: PHOTOS.park[3], rating: 4.7, address: "ul. Brzeźno", tags: ["plaża", "Bałtyk"], description: "Popularna plaża miejska z widokiem na Bałtyk i molo." },
      { id: "g-p5", name: "Molo Sopot", photo: PHOTOS.park[4], rating: 4.8, address: "al. Wojska Polskiego 11", tags: ["molo", "Sopot"], description: "Najdłuższe drewniane molo w Europie — spacer nad morzem obowiązkowy." },
      { id: "g-p6", name: "Westerplatte", photo: PHOTOS.park[5], rating: 4.6, address: "ul. Majora Henryka Sucharskiego", tags: ["historia", "pomnik"], description: "Symboliczne miejsce wybuchu II wojny światowej." },
      { id: "g-p7", name: "Park Reagana", photo: PHOTOS.park[6], rating: 4.4, address: "ul. Kliniczna 1", tags: ["park", "spacer"], description: "Spokojny park rodzinny z placami zabaw i terenami sportowymi." },
      { id: "g-p8", name: "Pchli Targ Oliwa", photo: PHOTOS.park[7], rating: 4.5, address: "ul. Leśna 2, Oliwa", tags: ["targ", "vintage"], description: "Cotygodniowy pchli targ z antykami i artykułami vintage." },
    ],
    experience: [
      { id: "g-e1", name: "Rejs po Motławie", photo: PHOTOS.experience[0], rating: 4.6, address: "Długie Pobrzeże", tags: ["rejs", "widoki"], description: "Rejs po Motławie z widokiem na historyczne spichlerze i żurawie." },
      { id: "g-e2", name: "Ulica Mariacka", photo: PHOTOS.experience[1], rating: 4.8, address: "ul. Mariacka", tags: ["spacer", "bursztyn"], description: "Najpiękniejsza ulica Gdańska z bursztynowymi sklepikami i wystawkami." },
      { id: "g-e3", name: "Baszta Tajemnic", photo: PHOTOS.experience[2], rating: 4.5, address: "ul. Ogarnia 15", tags: ["escape room", "przygoda"], description: "Klimatyczny escape room w historycznej baszcie gdańskich murów." },
      { id: "g-e4", name: "Olivia Star Widok", photo: PHOTOS.experience[3], rating: 4.7, address: "al. Grunwaldzka 472", tags: ["widok", "panorama"], description: "Panorama Gdańska, Sopotu i Gdyni z 33. piętra wieżowca Olivia Star." },
      { id: "g-e5", name: "Długi Targ nocą", photo: PHOTOS.experience[4], rating: 4.9, address: "Długi Targ", tags: ["nocna trasa", "fontanna"], description: "Iluminacje i Fontanna Neptuna — Gdańsk nocą jest magiczny." },
      { id: "g-e6", name: "Pixel XL Arcade", photo: PHOTOS.experience[5], rating: 4.5, address: "ul. Jana Heweliusza 11", tags: ["gry", "arcade"], description: "Centrum gier retro i nowoczesnych — nostalgia gwarantowana." },
      { id: "g-e7", name: "Tramwaj Wodny", photo: PHOTOS.experience[6], rating: 4.6, address: "Zielona Brama", tags: ["tramwaj wodny", "atrakcja"], description: "Tramwaj wodny po Motławie — najfajniejszy transport w Gdańsku." },
      { id: "g-e8", name: "Strefa Kibica Łącznik", photo: PHOTOS.experience[7], rating: 4.3, address: "ul. 3 Maja 9", tags: ["rozrywka", "sport"], description: "Centrum rozrywki z bolwingiem, bilarem i strefą gier." },
    ],
  },
  Warszawa: {
    cafe: [
      { id: "w-c1", name: "Café Kafka", photo: PHOTOS.cafe[0], rating: 4.7, address: "ul. Oboźna 3", tags: ["literacka", "klimatyczna"], description: "Klimatyczna kawiarnia literacka w kamienicy na Starówce." },
      { id: "w-c2", name: "Charlotte Chleb i Wino", photo: PHOTOS.cafe[1], rating: 4.8, address: "pl. Zbawiciela 4", tags: ["francuska", "wino"], description: "Kultowe miejsce na Placu Zbawiciela — pyszne kanapki i wino." },
      { id: "w-c3", name: "Stor", photo: PHOTOS.cafe[2], rating: 4.6, address: "ul. Mokotowska 55", tags: ["specialty coffee", "design"], description: "Minimalistische kawiarnia specialty ze skandynawskim designem." },
      { id: "w-c4", name: "Kawiarnia Kulturalna", photo: PHOTOS.cafe[3], rating: 4.5, address: "Pałac Kultury i Nauki", tags: ["PKiN", "unikalna"], description: "Kawiarnia w ikonicznym Pałacu Kultury i Nauki." },
      { id: "w-c5", name: "Relaks", photo: PHOTOS.cafe[4], rating: 4.4, address: "ul. Złota 8", tags: ["klasyczna", "retro"], description: "Legendarna bar mleczny i kawiarnia — smak dawnej Warszawy." },
      { id: "w-c6", name: "Café Wedel", photo: PHOTOS.cafe[5], rating: 4.7, address: "ul. Szpitalna 8", tags: ["czekolada", "tradycyjna"], description: "Słynna czekoladownia Wedla — gorąca czekolada obowiązkowa." },
      { id: "w-c7", name: "Filtry", photo: PHOTOS.cafe[6], rating: 4.5, address: "ul. Koszykowa 81", tags: ["specialty", "hip"], description: "Specialty coffee w industrialnym wnętrzu dawnej fabryki." },
      { id: "w-c8", name: "Baguetteria", photo: PHOTOS.cafe[7], rating: 4.6, address: "ul. Nowy Świat 22", tags: ["bagietki", "francuska"], description: "Autentyczne bagietki i croissanty prosto z Paryża." },
    ],
    restaurant: [
      { id: "w-r1", name: "Senses Restaurant", photo: PHOTOS.restaurant[0], rating: 4.9, address: "ul. Bielańska 12", tags: ["fine dining", "gwiazdka Michelin"], description: "Jedyna w Warszawie restauracja z gwiazdką Michelin." },
      { id: "w-r2", name: "Bez Gwiazdek", photo: PHOTOS.restaurant[1], rating: 4.7, address: "ul. Wilcza 73", tags: ["polska", "nowoczesna"], description: "Nowoczesna kuchnia polska w eleganckim wydaniu." },
      { id: "w-r3", name: "Zoni", photo: PHOTOS.restaurant[2], rating: 4.6, address: "ul. Hoża 55", tags: ["fusion", "kreatywna"], description: "Kreatywna fuzja kuchni europejskiej i azjatyckiej." },
      { id: "w-r4", name: "Butchery & Wine", photo: PHOTOS.restaurant[3], rating: 4.7, address: "ul. Żurawia 22", tags: ["steki", "wino"], description: "Najlepsze steki w Warszawie z imponującą kartą win." },
      { id: "w-r4b", name: "Próżna 9", photo: PHOTOS.restaurant[4], rating: 4.6, address: "ul. Próżna 9", tags: ["polska", "historyczna"], description: "Polska kuchnia w ostatniej zachowanej kamienicy dawnego getta." },
      { id: "w-r5", name: "Kuchnia Polska u Fukiera", photo: PHOTOS.restaurant[5], rating: 4.7, address: "Rynek Starego Miasta 27", tags: ["polska", "starówka"], description: "Tradycyjna kuchnia polska na Rynku Starego Miasta od 1590 roku." },
      { id: "w-r6", name: "Same Fusy", photo: PHOTOS.restaurant[6], rating: 4.5, address: "ul. Śniadeckich 22", tags: ["polska", "domowa"], description: "Domowa kuchnia polska z produktami od lokalnych dostawców." },
      { id: "w-r7", name: "Tel Aviv Urban Food", photo: PHOTOS.restaurant[7], rating: 4.6, address: "ul. Poznańska 11", tags: ["izraelska", "hummus"], description: "Autentyczna kuchnia izraelska — najlepszy hummus w mieście." },
    ],
    bar: [
      { id: "w-b1", name: "Coctail Bar Patio", photo: PHOTOS.bar[0], rating: 4.6, address: "ul. Mazowiecka 12", tags: ["koktajle", "ogródek"], description: "Bujne patio z doskonałymi koktajlami w centrum Warszawy." },
      { id: "w-b2", name: "Paloma", photo: PHOTOS.bar[1], rating: 4.7, address: "ul. Hoża 51", tags: ["tequila", "meksykański"], description: "Mezcal i tequila w najlepszym wydaniu — fiesta w Śródmieściu." },
      { id: "w-b3", name: "Craft Beer Muranów", photo: PHOTOS.bar[2], rating: 4.5, address: "ul. Nowolipki 6", tags: ["craft beer", "Muranów"], description: "Klimatyczny pub z craft piwem na modnym Muranowie." },
      { id: "w-b4", name: "55 Bar", photo: PHOTOS.bar[3], rating: 4.4, address: "ul. Poznańska 55", tags: ["koktajle", "intymny"], description: "Mały bar koktajlowy z wielką duszą na Poznańskiej." },
      { id: "w-b5", name: "Skład Butelek", photo: PHOTOS.bar[4], rating: 4.6, address: "ul. Grójecka 59", tags: ["craft beer", "Ochota"], description: "Rewelacyjny wybór polskiego craft beeru na Ochocie." },
      { id: "w-b6", name: "Winiarka", photo: PHOTOS.bar[5], rating: 4.5, address: "ul. Nowy Świat 27", tags: ["wino", "naturalny"], description: "Skup naturalnych win z całej Europy — sommelier pomoże wybrać." },
      { id: "w-b7", name: "Beirut Hummus & Music Bar", photo: PHOTOS.bar[6], rating: 4.7, address: "ul. Poznańska 12", tags: ["muzyka na żywo", "izraelski"], description: "Hummus i żywa muzyka — kultowe miejsce na Poznańskiej." },
      { id: "w-b8", name: "Cudowne Lata", photo: PHOTOS.bar[7], rating: 4.4, address: "ul. Wilcza 25", tags: ["PRL", "nostalgiczny"], description: "Powrót do lat 80. — meble z demobilu i polska muzyka." },
    ],
    museum: [
      { id: "w-m1", name: "Muzeum Powstania Warszawskiego", photo: PHOTOS.museum[0], rating: 4.9, address: "ul. Grzybowska 79", tags: ["II WŚ", "Powstanie"], description: "Jedno z najlepszych muzeów w Polsce — poruszająca historia Powstania Warszawskiego." },
      { id: "w-m2", name: "POLIN", photo: PHOTOS.museum[1], rating: 4.8, address: "ul. Anielewicza 6", tags: ["Żydzi", "historia"], description: "Muzeum Historii Żydów Polskich — wieloletnia historia żydowskiej społeczności." },
      { id: "w-m3", name: "Centrum Nauki Kopernik", photo: PHOTOS.museum[2], rating: 4.8, address: "ul. Wybrzeże Kościuszkowskie 20", tags: ["nauka", "interaktywne"], description: "Interaktywne centrum nauki dla dzieci i dorosłych — planetarium obowiązkowo." },
      { id: "w-m4", name: "Muzeum Narodowe", photo: PHOTOS.museum[3], rating: 4.6, address: "al. Jerozolimskie 3", tags: ["sztuka", "kolekcje"], description: "Największa kolekcja sztuki w Polsce od antyku po współczesność." },
      { id: "w-m5", name: "Zamek Królewski", photo: PHOTOS.museum[4], rating: 4.7, address: "pl. Zamkowy 4", tags: ["zamek", "historia"], description: "Odbudowany zamek królewski — symbol wolności Warszawy." },
      { id: "w-m6", name: "Muzeum Sztuki Nowoczesnej", photo: PHOTOS.museum[5], rating: 4.6, address: "pl. Defilad 1", tags: ["sztuka", "nowoczesne"], description: "Nowe muzeum sztuki nowoczesnej przy PKiN — architektura i kolekcja wow." },
      { id: "w-m7", name: "Łazienki Królewskie", photo: PHOTOS.museum[6], rating: 4.8, address: "ul. Agrykoli 1", tags: ["pałac", "park"], description: "Pałac na Wyspie w przepięknym parku — niedziela z Chopinem." },
      { id: "w-m8", name: "Muzeum Chopina", photo: PHOTOS.museum[7], rating: 4.7, address: "ul. Okólnik 1", tags: ["muzyka", "Chopin"], description: "Multimedialne muzeum poświęcone Fryderykowi Chopinowi." },
    ],
    park: [
      { id: "w-p1", name: "Łazienki Królewskie", photo: PHOTOS.park[0], rating: 4.9, address: "ul. Agrykoli 1", tags: ["pałac", "park"], description: "Najpiękniejszy park Warszawy z Pałacem na Wyspie i pawiem." },
      { id: "w-p2", name: "Park Skaryszewski", photo: PHOTOS.park[1], rating: 4.7, address: "al. Zielieniecka 1", tags: ["jezioro", "spacer"], description: "Urokliwy park z jeziorkiem Kamionkowskim i trasami rowerowymi." },
      { id: "w-p3", name: "Ogród Saski", photo: PHOTOS.park[2], rating: 4.6, address: "ul. Królewska 1", tags: ["historyczny", "fontanna"], description: "Najstarszy park publiczny w Polsce z piękną fontanną." },
      { id: "w-p4", name: "Bulwary Wiślane", photo: PHOTOS.park[3], rating: 4.8, address: "ul. Wybrzeże Kościuszkowskie", tags: ["rzeka", "życie miejskie"], description: "Rewitalizowane bulwary nad Wisłą — centrum życia towarzyskiego latem." },
      { id: "w-p5", name: "Pole Mokotowskie", photo: PHOTOS.park[4], rating: 4.7, address: "al. Niepodległości", tags: ["sport", "piknik"], description: "Rozległy park w centrum — bieganie, kite, pikniki." },
      { id: "w-p6", name: "Las Kabacki", photo: PHOTOS.park[5], rating: 4.6, address: "ul. Baśniowa 1", tags: ["las", "spacer"], description: "Zielone płuca Ursynowa — ponad 900 ha naturalnego lasu." },
      { id: "w-p7", name: "Ogród Botaniczny", photo: PHOTOS.park[6], rating: 4.6, address: "al. Ujazdowskie 4", tags: ["botaniczny", "kwiaty"], description: "Ogród Botaniczny Uniwersytetu Warszawskiego — oaza spokoju." },
      { id: "w-p8", name: "Park Praski", photo: PHOTOS.park[7], rating: 4.5, address: "al. Solidarności 2", tags: ["Praga", "ZOO"], description: "Park przy praskim ZOO — klimat prawdziwej Pragi." },
    ],
    experience: [
      { id: "w-e1", name: "PKiN Taras Widokowy", photo: PHOTOS.experience[0], rating: 4.6, address: "pl. Defilad 1", tags: ["widok", "panorama"], description: "Panorama Warszawy z 30. piętra — Warszawa jakiej nie widziałeś." },
      { id: "w-e2", name: "Nocna wycieczka po Starówce", photo: PHOTOS.experience[1], rating: 4.8, address: "Rynek Starego Miasta", tags: ["historia", "nocna"], description: "Odbudowana Starówka nocą świeci tysiącem świateł — magia." },
      { id: "w-e3", name: "Bazar Różyckiego", photo: PHOTOS.experience[2], rating: 4.4, address: "ul. Targowa 54", tags: ["bazar", "Praga"], description: "Legendarny bazar na Pradze — autentyczne miejskie targowisko." },
      { id: "w-e4", name: "Kinoteka", photo: PHOTOS.experience[3], rating: 4.5, address: "pl. Defilad 1", tags: ["kino", "PKiN"], description: "Kultowe kino w PKiN ze starymi salonami i wielkim ekranem." },
      { id: "w-e5", name: "Festiwal Nauki", photo: PHOTOS.experience[4], rating: 4.7, address: "Centrum Nauki Kopernik", tags: ["nauka", "festiwal"], description: "Coroczny festiwal nauki dla każdego — warsztaty, wykłady, pokazy." },
      { id: "w-e6", name: "Praga Street Art", photo: PHOTOS.experience[5], rating: 4.6, address: "ul. Ząbkowska", tags: ["street art", "Praga"], description: "Praskie murale i street art — galeria sztuki pod gołym niebem." },
      { id: "w-e7", name: "Muzyczne niedziela w Łazienkach", photo: PHOTOS.experience[6], rating: 4.8, address: "Łazienki Królewskie", tags: ["Chopin", "muzyka"], description: "Niedzielne koncerty chopinowskie przy pomniku Chopina — tradycja od lat." },
      { id: "w-e8", name: "Stand-up Komedia", photo: PHOTOS.experience[7], rating: 4.5, address: "ul. Wilcza 25", tags: ["stand-up", "śmiech"], description: "Najlepszy klub stand-upowy w Polsce — śmiech gwarantowany." },
    ],
  },
  Wrocław: {
    cafe: [
      { id: "wr-c1", name: "Przedwojenna Kamienica", photo: PHOTOS.cafe[0], rating: 4.8, address: "ul. Świdnicka 22", tags: ["klimatyczna", "vintage"], description: "Kawiarnia w duchu dawnego Breslau — przepiękne wnętrze i świetna kawa." },
      { id: "wr-c2", name: "Coffeina", photo: PHOTOS.cafe[1], rating: 4.6, address: "ul. Oławska 19", tags: ["specialty coffee", "centrum"], description: "Specialty coffee w samym sercu Wrocławia." },
      { id: "wr-c3", name: "Café Targowa", photo: PHOTOS.cafe[2], rating: 4.5, address: "ul. Targowa 2", tags: ["lokalna", "slow"], description: "Mała lokalna kawiarnia w cichej kamienicy niedaleko Rynku." },
      { id: "wr-c4", name: "Mono Espresso Bar", photo: PHOTOS.cafe[3], rating: 4.7, address: "ul. Kuźnicza 33", tags: ["espresso", "minimalizm"], description: "Perfekcyjne espresso w minimalistycznym barze." },
      { id: "wr-c5", name: "Wrocławska Palarnia Kawy", photo: PHOTOS.cafe[4], rating: 4.6, address: "ul. Świdnicka 37", tags: ["palarnia", "specialty"], description: "Lokalna palarnia z doskonałą kawą świeżo paloną na miejscu." },
      { id: "wr-c6", name: "Filiżanka Café", photo: PHOTOS.cafe[5], rating: 4.4, address: "Rynek 38", tags: ["rynek", "widok"], description: "Kawiarnia z widokiem na Rynek — idealne miejsce na odpoczynek." },
      { id: "wr-c7", name: "Akademia Kawy", photo: PHOTOS.cafe[6], rating: 4.5, address: "ul. Ruska 46", tags: ["barista", "edukacja"], description: "Kawiarnia prowadzona przez profesjonalnych baristów." },
      { id: "wr-c8", name: "Leśna Kawiarnia", photo: PHOTOS.cafe[7], rating: 4.6, address: "ul. Parkowa 1", tags: ["las", "natura"], description: "Klimatyczna kawiarnia przy parku — kawa i natura w jednym." },
    ],
    restaurant: [
      { id: "wr-r1", name: "Spiż", photo: PHOTOS.restaurant[0], rating: 4.7, address: "Rynek-Ratusz 2", tags: ["browar", "polska"], description: "Restauracja-browar w piwnicy Ratusza z własnym piwem." },
      { id: "wr-r2", name: "Magnolia", photo: PHOTOS.restaurant[1], rating: 4.8, address: "ul. Świdnicka 53", tags: ["fine dining", "polska"], description: "Elegancka fine dining z nowoczesną polską kuchnią." },
      { id: "wr-r3", name: "Kurna Chata", photo: PHOTOS.restaurant[2], rating: 4.6, address: "ul. Świdnicka 38", tags: ["tradycyjna", "polska"], description: "Tradycyjna kuchnia polska w rustykalnym wnętrzu." },
      { id: "wr-r4", name: "La Scala", photo: PHOTOS.restaurant[3], rating: 4.5, address: "ul. Ruska 51", tags: ["włoska", "pizza"], description: "Autentyczna włoska pizza i pasta w centrum Wrocławia." },
      { id: "wr-r5", name: "Karczma Lwowska", photo: PHOTOS.restaurant[4], rating: 4.7, address: "Rynek 4", tags: ["lwowska", "tradycyjna"], description: "Kuchnia kresowa w przepięknej kamienicy przy Rynku." },
      { id: "wr-r6", name: "Green Way", photo: PHOTOS.restaurant[5], rating: 4.4, address: "ul. Świdnicka 44", tags: ["wegańska", "zdrowa"], description: "Najlepsza wegańska restauracja Wrocławia od lat." },
      { id: "wr-r7", name: "Dom Piwa", photo: PHOTOS.restaurant[6], rating: 4.5, address: "ul. Piłsudskiego 86", tags: ["craft beer", "pub food"], description: "Pub z imponującą selekcją piw i pysznym jedzeniem." },
      { id: "wr-r8", name: "Ramen Wrocław", photo: PHOTOS.restaurant[7], rating: 4.6, address: "ul. Ruska 62", tags: ["japońska", "ramen"], description: "Autentyczny japoński ramen — rosół który rozgrzewa duszę." },
    ],
    bar: [
      { id: "wr-b1", name: "Kontynent Bar", photo: PHOTOS.bar[0], rating: 4.5, address: "ul. Świdnicka 23", tags: ["koktajle", "lounge"], description: "Elegancki bar koktajlowy w centrum Wrocławia." },
      { id: "wr-b2", name: "PiwPaw Wrocław", photo: PHOTOS.bar[1], rating: 4.7, address: "ul. Ruska 51", tags: ["craft beer", "wybór"], description: "Ogromny wybór polskiego i zagranicznego craft beeru." },
      { id: "wr-b3", name: "Absurdalny Bar", photo: PHOTOS.bar[2], rating: 4.4, address: "ul. Kuźnicza 18", tags: ["studencki", "tani"], description: "Legendarny studencki bar — imprezy i świetna atmosfera." },
      { id: "wr-b4", name: "Mleczarnia", photo: PHOTOS.bar[3], rating: 4.6, address: "ul. Włodkowica 5", tags: ["klimatyczny", "Nadodrze"], description: "Klimatyczny bar w starej mleczarni na modnym Nadodrzu." },
      { id: "wr-b5", name: "Cocktail Bar Neon", photo: PHOTOS.bar[4], rating: 4.5, address: "ul. Oławska 7", tags: ["neony", "koktajle"], description: "Bar z pięknymi neonami i doskonałymi koktajlami." },
      { id: "wr-b6", name: "Szklana Pułapka", photo: PHOTOS.bar[5], rating: 4.3, address: "ul. Świdnicka 55", tags: ["pub", "casual"], description: "Przyjazny pub z dobrymi cenami i sympatyczną ekipą." },
      { id: "wr-b7", name: "Whisky Bar Libreria", photo: PHOTOS.bar[6], rating: 4.7, address: "ul. Ruska 46", tags: ["whisky", "premium"], description: "Szeroki wybór whisky i przyjemna, ciemna atmosfera." },
      { id: "wr-b8", name: "Pijana Wiśnia", photo: PHOTOS.bar[7], rating: 4.5, address: "Rynek 27", tags: ["wiśniówka", "polska"], description: "Kultowy bar z wiśniówką — wrocławska legenda." },
    ],
    museum: [
      { id: "wr-m1", name: "Panorama Racławicka", photo: PHOTOS.museum[0], rating: 4.9, address: "ul. Jana Ewangelisty Purkyniego 11", tags: ["panorama", "bitwa"], description: "Jedyna w Polsce panoramiczna rotunda z obrazem Bitwy pod Racławicami." },
      { id: "wr-m2", name: "Muzeum Narodowe", photo: PHOTOS.museum[1], rating: 4.7, address: "pl. Powstańców Warszawy 5", tags: ["sztuka", "kolekcje"], description: "Imponująca kolekcja sztuki od średniowiecza po współczesność." },
      { id: "wr-m3", name: "Hydropolis", photo: PHOTOS.museum[2], rating: 4.8, address: "ul. Na Grobli 17", tags: ["woda", "interaktywne"], description: "Interaktywne centrum wiedzy o wodzie w dawnej stacji uzdatniania." },
      { id: "wr-m4", name: "Muzeum Miejskie", photo: PHOTOS.museum[3], rating: 4.5, address: "ul. Sukiennice 14", tags: ["historia", "Wrocław"], description: "Historia Breslau/Wrocławia od średniowiecza po czasy współczesne." },
      { id: "wr-m5", name: "Muzeum Architektury", photo: PHOTOS.museum[4], rating: 4.4, address: "ul. Bernardyńska 5", tags: ["architektura", "design"], description: "Jedyne muzeum architektury w Polsce w gotyckim klasztorze." },
      { id: "wr-m6", name: "Centrum Historii Zajezdnia", photo: PHOTOS.museum[5], rating: 4.7, address: "ul. Grabiszyńska 184", tags: ["historia", "Solidarność"], description: "Centrum historii regionu w dawnej zajezdni tramwajowej." },
      { id: "wr-m7", name: "Muzeum Przyrodnicze", photo: PHOTOS.museum[6], rating: 4.6, address: "ul. Sienkiewicza 21", tags: ["przyroda", "dinozaury"], description: "Imponujące eksponaty zwierząt i dinozaurów dla całej rodziny." },
      { id: "wr-m8", name: "Galeria Sztuki BWA", photo: PHOTOS.museum[7], rating: 4.5, address: "ul. Świdnicka 2a", tags: ["sztuka", "wystawy"], description: "Czołowa galeria sztuki współczesnej na Dolnym Śląsku." },
    ],
    park: [
      { id: "wr-p1", name: "Ostrów Tumski", photo: PHOTOS.park[0], rating: 4.9, address: "Ostrów Tumski", tags: ["katedra", "historia"], description: "Najstarszy fragment Wrocławia — katedra i latarnie gazowe tworzą magię." },
      { id: "wr-p2", name: "Park Szczytnicki", photo: PHOTOS.park[1], rating: 4.8, address: "ul. Adama Mickiewicza 4", tags: ["ogród japoński", "spacer"], description: "Najpiękniejszy park Wrocławia z japońskim ogrodem i Halą Stulecia." },
      { id: "wr-p3", name: "Ogród Japoński", photo: PHOTOS.park[2], rating: 4.8, address: "ul. Adama Mickiewicza 2", tags: ["japoński", "kwiaty"], description: "Autentyczny japoński ogród zen w środku Wrocławia." },
      { id: "wr-p4", name: "Wyspa Słodowa", photo: PHOTOS.park[3], rating: 4.7, address: "Wyspa Słodowa", tags: ["rzeka", "młodzież"], description: "Kultowa wyspa studencka nad Odrą — koncerty i relaks latem." },
      { id: "wr-p5", name: "Park Zachodni", photo: PHOTOS.park[4], rating: 4.5, address: "ul. Zachodnia 1", tags: ["spokojny", "rodzinny"], description: "Spokojny park rodzinny z oczkiem wodnym i placami zabaw." },
      { id: "wr-p6", name: "Bulwar Xawerego Dunikowskiego", photo: PHOTOS.park[5], rating: 4.6, address: "Bulwar Xawerego Dunikowskiego", tags: ["rzeka", "spacer"], description: "Nadodrzański bulwar z widokiem na katedry Ostrowa Tumskiego." },
      { id: "wr-p7", name: "Park Południowy", photo: PHOTOS.park[6], rating: 4.5, address: "ul. Świdnicka 127", tags: ["spacer", "fontanna"], description: "Zielony park z fontanną i trasami rowerowymi." },
      { id: "wr-p8", name: "Promenada Staromiejska", photo: PHOTOS.park[7], rating: 4.6, address: "ul. Świdnicka 1", tags: ["fosa", "spacer"], description: "Spacer wzdłuż fosy miejskiej pod cieniem starych kasztanowców." },
    ],
    experience: [
      { id: "wr-e1", name: "Szukanie Krasnali", photo: PHOTOS.experience[0], rating: 4.8, address: "Rynek Wrocław", tags: ["krasnale", "zabawa"], description: "Polowanie na ponad 700 wrocławskich krasnali — świetna zabawa dla wszystkich." },
      { id: "wr-e2", name: "Hala Stulecia", photo: PHOTOS.experience[1], rating: 4.7, address: "ul. Wystawowa 1", tags: ["architektura", "UNESCO"], description: "Arcydzieło architektury wpisane na Listę UNESCO — concerty i wystawy." },
      { id: "wr-e3", name: "Fontanna Multimedialna", photo: PHOTOS.experience[2], rating: 4.9, address: "Park Szczytnicki", tags: ["fontanna", "show"], description: "Spektakularne wieczorne pokazy fontanny — woda, muzyka i światło." },
      { id: "wr-e4", name: "Escape Room Enigma", photo: PHOTOS.experience[3], rating: 4.7, address: "ul. Świdnicka 30", tags: ["escape room", "przygoda"], description: "Najlepszy escape room we Wrocławiu z klimatycznymi pokojami." },
      { id: "wr-e5", name: "Targi Dobrego Designu", photo: PHOTOS.experience[4], rating: 4.6, address: "Hala Stulecia", tags: ["design", "targi"], description: "Coroczne targi polskiego designu — najlepsza polska kreatywność." },
      { id: "wr-e6", name: "Planety Wrocław", photo: PHOTOS.experience[5], rating: 4.5, address: "ul. Świdnicka 46", tags: ["kosmiczne", "science"], description: "Interaktywne centrum nauki z planetarium dla każdego." },
      { id: "wr-e7", name: "Rejs Gondolą po Odrze", photo: PHOTOS.experience[6], rating: 4.7, address: "ul. Śluza 2", tags: ["gondola", "rzeka"], description: "Romantyczny rejs gondolą po kanałach Odrze — jak w Wenecji." },
      { id: "wr-e8", name: "OFF Piotrkowska Wrocław", photo: PHOTOS.experience[7], rating: 4.5, address: "ul. Ruska 46c", tags: ["street food", "kultura"], description: "Centrum kulturalne z food truckami, sklepami i galeriami." },
    ],
  },
};

const DEMO_CITIES = Object.keys(MOCK_DATA);
const DEMO_CATEGORIES = [
  { id: "cafe",       label: "Kawiarnia",   emoji: "☕"  },
  { id: "restaurant", label: "Restauracja", emoji: "🍽️" },
  { id: "bar",        label: "Bar",         emoji: "🍺"  },
  { id: "museum",     label: "Muzeum",      emoji: "🏛️" },
  { id: "park",       label: "Park",        emoji: "🌿"  },
  { id: "experience", label: "Rozrywka",    emoji: "🎪"  },
];

type Step = "city" | "mode" | "category" | "swipe" | "results" | "invite";

// ─── Convert DemoPlace → MockPlace ────────────────────────────────────────────

function toMock(p: DemoPlace, city: string, category: string): MockPlace {
  return {
    id: p.id,
    place_name: p.name,
    category: category as PlaceCategory,
    city,
    address: p.address,
    latitude: 0,
    longitude: 0,
    rating: p.rating,
    photo_url: p.photo,
    vibe_tags: p.tags,
    description: p.description,
  };
}

// ─── Real SwipeCard stack (GroupSession-style UI) ─────────────────────────────

function DemoSwiper({ places, city, category, onComplete }: {
  places: DemoPlace[];
  city: string;
  category: string;
  onComplete: (liked: DemoPlace[]) => void;
}) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DemoPlace[]>(places);
  const [liked, setLiked] = useState<DemoPlace[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "matches">("explore");
  const [showUpsell, setShowUpsell] = useState(false);

  // Auto-switch to matches when all cards are swiped
  useEffect(() => {
    if (queue.length === 0 && activeTab === "explore") setActiveTab("matches");
  }, [queue.length]);

  const catInfo = DEMO_CATEGORIES.find(c => c.id === category);
  const mockQueue = queue.map(p => toMock(p, city, category));
  const cardSlice = mockQueue.slice(0, 3);
  const swiped = places.length - queue.length;

  const handleLike = () => {
    setLiked(prev => [...prev, queue[0]]);
    setQueue(prev => prev.slice(1));
  };

  const handleSkip = () => {
    setQueue(prev => prev.slice(1));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* GroupSession-style sub-header */}
      <div className="px-4 pt-2 pb-1.5 shrink-0">
        <p className="text-sm font-bold flex items-center gap-1.5">
          {city}
          <span>{catInfo?.emoji}</span>
          <span className="text-orange-600">{catInfo?.label}</span>
        </p>
        <p className="text-xs text-muted-foreground">Demo · runda 1</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30 px-4 shrink-0">
        {(["explore", "matches"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-2.5 mr-6 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
              activeTab === tab
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-muted-foreground"
            )}
          >
            {tab === "explore" ? "Eksploruj" : "Dopasowania"}
            {tab === "matches" && liked.length > 0 && (
              <span className={cn(
                "text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none",
                activeTab === "matches" ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"
              )}>
                {liked.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Eksploruj ── */}
      {activeTab === "explore" && (
        <>
          <div className="px-5 py-2 text-xs text-muted-foreground shrink-0">
            Miejsce {swiped}/{places.length}
          </div>

          {queue.length > 0 ? (
            <div className="relative mx-4 mb-4" style={{ flex: "1 1 0", minHeight: 0, maxHeight: "min(680px, 78dvh)" }}>
              {cardSlice.slice().reverse().map((place, reversedIdx) => {
                const offset = cardSlice.length - 1 - reversedIdx;
                return (
                  <SwipeCard
                    key={place.id}
                    place={place}
                    city={city}
                    onLike={handleLike}
                    onSkip={handleSkip}
                    onTap={() => { setDetailPlace(place); setDetailOpen(true); }}
                    isTop={offset === 0}
                    offset={offset}
                    skipGoogleFetch={true}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
              <p className="text-5xl">✅</p>
              <p className="font-bold text-lg">Przejrzałeś wszystkie miejsca!</p>
              <p className="text-sm text-muted-foreground">Sprawdź swoje dopasowania w drugiej zakładce.</p>
              <button
                onClick={() => setActiveTab("matches")}
                className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                Zobacz dopasowania →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Dopasowania ── */}
      {activeTab === "matches" && (
        <div className="flex-1 flex flex-col overflow-y-auto px-4 pt-4 pb-6 gap-3">
          {liked.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
              <p className="text-4xl">❤️</p>
              <p className="font-semibold">Brak polubionych miejsc</p>
              <p className="text-sm text-muted-foreground">Swipe'uj miejsca i wróć tutaj</p>
              <button onClick={() => setActiveTab("explore")} className="text-sm font-semibold text-orange-600">
                Wróć do eksplorowania →
              </button>
            </div>
          ) : (
            <>
              {liked.map((place, i) => (
                <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
                  <span className="h-7 w-7 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {i + 1}
                  </span>
                  <img src={place.photo} alt={place.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowUpsell(true)}
                className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform mt-1"
              >
                Stwórz trasę →
              </button>
            </>
          )}
        </div>
      )}

      <PlaceSwiperDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        place={detailPlace}
        city={city}
        onLike={() => { handleLike(); setDetailOpen(false); }}
        onSkip={() => { handleSkip(); setDetailOpen(false); }}
        skipGoogleFetch={true}
      />

      {/* Upsell modal */}
      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-t-3xl px-6 pt-8 pb-10 flex flex-col items-center gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="h-14 w-14 rounded-2xl bg-orange-600/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-orange-600" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-2xl font-black">Dołącz do Trasy!</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Załóż konto i stwórz prawdziwą trasę z Twoich ulubionych miejsc. Zajmuje 30 sekund.
              </p>
            </div>
            <ul className="w-full space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Zapisz trasę i nawiguj po niej</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Paruj miejsca razem z grupą znajomych</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Nieograniczone kategorie i rundy</li>
              <li className="flex items-center gap-2"><span className="text-orange-600 font-bold">✓</span> Historia wszystkich wspólnych planów</li>
            </ul>
            <button
              onClick={() => navigate("/auth")}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/25"
            >
              Załóż konto — to nic nie kosztuje →
            </button>
            <button
              onClick={() => setShowUpsell(false)}
              className="text-sm text-muted-foreground"
            >
              Wróć do demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DemoSession ──────────────────────────────────────────────────────────────

export default function DemoSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("city");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [likedPlaces, setLikedPlaces] = useState<DemoPlace[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [groupReactions, setGroupReactions] = useState<Record<string, { device_id: string; liked: boolean }[]>>({});
  const [otherDeviceDone, setOtherDeviceDone] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState(DEMO_CITIES[0]);

  // Handle ?join=CODE — second user joins existing session
  useEffect(() => {
    const joinCode = searchParams.get("join");
    if (!joinCode) return;
    (supabase as any).from("demo_sessions").select("*").eq("code", joinCode).single()
      .then(({ data }: any) => {
        if (data) {
          setCity(data.city);
          setCategory(data.category as CategoryKey);
          setSessionCode(joinCode);
          setMode("group");
          setStep("swipe");
        } else {
          toast.error("Nie znaleziono sesji — sprawdź kod i spróbuj ponownie");
        }
      });
  }, []);

  const places: DemoPlace[] = city && category ? (MOCK_DATA[city]?.[category] ?? []) : [];

  const handleStartSolo = () => { setCity(selectedCity); setMode("solo"); setStep("category"); };
  const handleStartGroup = () => { setCity(selectedCity); setMode("group"); setStep("category"); };

  const handleJoinByCode = async () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) return;
    setJoinLoading(true);
    try {
      const { data } = await (supabase as any).from("demo_sessions").select("*").eq("code", code).single();
      if (data) {
        setCity(data.city);
        setCategory(data.category as CategoryKey);
        setSessionCode(code);
        setMode("group");
        setStep("swipe");
      } else {
        toast.error("Nie znaleziono sesji — sprawdź kod i spróbuj ponownie");
      }
    } catch {
      toast.error("Błąd połączenia — spróbuj ponownie");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCitySelect = (c: string) => { setCity(c); setStep("mode"); };

  const handleCategorySelect = async (cat: CategoryKey) => {
    setCategory(cat);
    if (mode === "group") {
      setGroupLoading(true);
      try {
        const code = generateJoinCode();
        const { error } = await (supabase as any).from("demo_sessions").insert({ code, city, category: cat });
        if (error) throw error;
        setSessionCode(code);
        setStep("invite");
      } catch (e: any) {
        console.error("[demo] session create error:", e);
        toast.error("Nie udało się utworzyć sesji — spróbuj ponownie");
      } finally {
        setGroupLoading(false);
      }
    } else {
      setStep("swipe");
    }
  };

  const handleSwipeComplete = async (liked: DemoPlace[]) => {
    setLikedPlaces(liked);
    if (mode === "group" && sessionCode) {
      const deviceId = getDeviceId();
      const allPlaces = MOCK_DATA[city]?.[category!] ?? [];
      const reactions = allPlaces.map(p => ({
        session_code: sessionCode,
        device_id: deviceId,
        place_name: p.name,
        liked: liked.some(l => l.id === p.id),
      }));
      try {
        await (supabase as any).from("demo_reactions").upsert(reactions);
        const { data: allReactions } = await (supabase as any)
          .from("demo_reactions").select("*").eq("session_code", sessionCode);
        if (allReactions) {
          const byPlace: Record<string, { device_id: string; liked: boolean }[]> = {};
          for (const r of allReactions) {
            if (!byPlace[r.place_name]) byPlace[r.place_name] = [];
            byPlace[r.place_name].push({ device_id: r.device_id, liked: r.liked });
          }
          setGroupReactions(byPlace);
          const uniqueDevices = new Set(allReactions.map((r: any) => r.device_id));
          setOtherDeviceDone(uniqueDevices.size >= 2);
        }
      } catch (e) {
        console.error("[demo] failed to save reactions:", e);
      }
    }
    setStep("results");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/demo?join=${sessionCode}`);
    toast.success("Link skopiowany!");
  };

  const catLabel = DEMO_CATEGORIES.find(c => c.id === category);

  // Group matches: places liked by both devices
  const groupMatches: DemoPlace[] = mode === "group" && otherDeviceDone
    ? (MOCK_DATA[city]?.[category!] ?? []).filter(p => {
        const r = groupReactions[p.name] ?? [];
        return r.length >= 2 && r.every(x => x.liked);
      })
    : [];

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header — hidden on landing */}
      <div className={cn("flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0", step === "city" && "hidden")}>
        <button
          onClick={() => {
            if (step === "city") navigate("/");
            else if (step === "category") setStep("city");
            else if (step === "invite") setStep("category");
            else if (step === "swipe") { if (mode === "group" && sessionCode) setStep("invite"); else setStep("category"); }
            else if (step === "results") setStep("swipe");
          }}
          className="h-9 w-9 flex items-center justify-center -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight">
            {step === "city" ? "Wypróbuj Trasę"
              : step === "category" ? city
              : step === "invite" ? "Zaproś znajomego"
              : step === "swipe" ? `${catLabel?.emoji} ${catLabel?.label}`
              : mode === "group" ? "Wspólne dopasowania" : "Twoje propozycje"}
          </p>
          {(step === "swipe" || step === "results") && <p className="text-xs text-muted-foreground">{city}</p>}
        </div>
        <span className="text-xs bg-orange-600/10 text-orange-600 font-semibold px-2.5 py-1 rounded-full">Demo</span>
      </div>

      {/* ── STEP: city (landing) ── */}
      {step === "city" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Hero — text left + cards right bleeding off screen */}
          <div className="bg-background shrink-0 overflow-hidden flex items-center px-5 pt-6 pb-4 gap-2" style={{ minHeight: "34vh" }}>
            {/* Left: headline */}
            <div className="flex-1 shrink-0 z-10">
              <h1 className="text-3xl font-black leading-tight">Speed dating<br/>z miastem.</h1>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-[170px]">
                Odkryj kawiarnie, restauracje i atrakcje razem z ekipą.
              </p>
            </div>

            {/* Right: card stack, bleeds off right edge */}
            <div className="relative shrink-0" style={{ width: "148px", height: "210px", marginRight: "-48px" }}>
              {/* Park — back */}
              <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-md"
                style={{ transform: "rotate(-8deg) translate(-28px, 16px)" }}>
                <img src="https://images.unsplash.com/photo-1519197924294-4ba991a11128?w=400&q=80" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">Park</span>
                  <p className="text-white text-[11px] font-bold mt-0.5">Łazienki</p>
                  <p className="text-yellow-400 text-[9px]">★ 4.9</p>
                </div>
              </div>
              {/* Restaurant — middle */}
              <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-lg"
                style={{ transform: "rotate(7deg) translate(10px, -12px)" }}>
                <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">Restauracja</span>
                  <p className="text-white text-[11px] font-bold mt-0.5">Butchery & Wine</p>
                  <p className="text-yellow-400 text-[9px]">★ 4.7</p>
                </div>
              </div>
              {/* Cafe — front */}
              <div className="absolute w-36 h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white"
                style={{ transform: "rotate(-2deg) translate(-8px, -6px)" }}>
                <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=80" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Kawiarnia</span>
                  <p className="text-white text-[11px] font-bold mt-0.5">Charlotte</p>
                  <p className="text-yellow-400 text-[9px]">★ 4.8</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Wybierz miasto</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_CITIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCity(c)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-[0.97]",
                      selectedCity === c
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border/60 text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card px-4 py-3.5 space-y-2.5">
              <p className="text-sm font-semibold">Masz kod zaproszenia?</p>
              <div className="flex gap-2">
                <input
                  value={joinInput}
                  onChange={e => setJoinInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleJoinByCode()}
                  placeholder="np. ABC123"
                  maxLength={8}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border/60 bg-background text-sm font-mono font-bold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-orange-600/30"
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={joinInput.trim().length < 4 || joinLoading}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.97] transition-transform flex items-center gap-1.5"
                >
                  {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dołącz"}
                </button>
              </div>
            </div>
          </div>

          {/* Sticky bottom CTAs */}
          <div className="shrink-0 px-5 pb-6 pt-2 space-y-2">
            <button
              onClick={handleStartGroup}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/25"
            >
              <Users className="h-5 w-5" />
              Zacznij z grupą
            </button>
            <button
              onClick={handleStartSolo}
              className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <User className="h-5 w-5" />
              Zacznij solo
            </button>
            <p className="text-center text-xs text-muted-foreground pt-1">
              Masz konto?{" "}
              <button onClick={() => navigate("/auth")} className="text-orange-600 font-semibold">
                Zaloguj się →
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── STEP: category ── */}
      {step === "category" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-5">
            <div>
              <p className="text-xl font-black mb-1">Wybierz kategorię</p>
              <p className="text-sm text-muted-foreground">
                {mode === "group" ? "Wybierz kategorię i zaproś znajomego — oboje będziecie swipe'ować te same miejsca." : "W demo możesz wybrać 1 kategorię i przejrzeć 8 miejsc."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id as CategoryKey)}
                  disabled={groupLoading}
                  className="px-4 py-3 rounded-2xl text-sm font-semibold border border-border/60 bg-card flex items-center gap-2 active:scale-[0.97] transition-transform hover:border-orange-600/40 disabled:opacity-60"
                >
                  {groupLoading && category === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{cat.emoji}</span>}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 px-4 pb-8 pt-2">
            <div className="rounded-2xl bg-muted/50 px-4 py-3 flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Pełna wersja: nieograniczone kategorie, rundy z grupą znajomych i zapisywanie tras.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: invite ── */}
      {step === "invite" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 space-y-5">
            <div>
              <p className="text-2xl font-black mb-1.5">Zaproś znajomego</p>
              <p className="text-sm text-muted-foreground">Wyślij kod lub link — gdy dołączy, zaczniecie swipe'ować te same miejsca i zobaczycie co Was łączy.</p>
            </div>

            <div className="rounded-2xl bg-muted/60 px-5 py-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kod sesji</p>
                <p className="text-3xl font-black tracking-widest text-foreground">{sessionCode}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="h-10 w-10 rounded-xl bg-card border border-border/60 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              >
                {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 rounded-2xl border border-border/60 bg-card text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              Skopiuj link zaproszenia
            </button>

            <div className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Znajomy otwiera link i od razu trafia do tej samej sesji — zero rejestracji.
            </div>
          </div>
          <div className="shrink-0 px-5 pb-8 pt-3">
            <button
              onClick={() => setStep("swipe")}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/20"
            >
              <Users className="h-5 w-5" />
              Zaczynamy!
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: swipe ── */}
      {step === "swipe" && places.length > 0 && (
        <DemoSwiper places={places} city={city} category={category!} onComplete={handleSwipeComplete} />
      )}

      {/* ── STEP: results ── */}
      {step === "results" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4">

            {/* Group: waiting for partner */}
            {mode === "group" && !otherDeviceDone && (
              <div className="rounded-2xl bg-muted/50 border border-border/40 px-5 py-5 flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-6 w-6 text-orange-600 animate-spin" />
                <p className="font-semibold">Czekamy na znajomego…</p>
                <p className="text-xs text-muted-foreground">Gdy skończy swipe'ować, zobaczycie wspólne dopasowania.</p>
                <p className="text-xs font-mono bg-background border border-border/50 px-3 py-1.5 rounded-xl">{sessionCode}</p>
              </div>
            )}

            {/* Group: both done — show matches */}
            {mode === "group" && otherDeviceDone && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {groupMatches.length > 0 ? "Macie wspólne miejsca! 🎉" : "Brak dopasowań"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {groupMatches.length > 0
                    ? `${groupMatches.length} ${groupMatches.length === 1 ? "miejsce" : groupMatches.length < 5 ? "miejsca" : "miejsc"} polubiliście oboje`
                    : "Tym razem się nie pokryło — spróbujcie innej kategorii"}
                </p>
              </div>
            )}

            {/* Solo results header */}
            {mode === "solo" && (
              <div className="text-center">
                <p className="text-2xl font-black">
                  {likedPlaces.length > 0 ? "Twoje propozycje 🎉" : "Żadnych lajków"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {likedPlaces.length > 0
                    ? `Polubiłeś/aś ${likedPlaces.length} ${likedPlaces.length === 1 ? "miejsce" : likedPlaces.length < 5 ? "miejsca" : "miejsc"} w ${city}`
                    : "Spróbuj jeszcze raz i polub jakieś miejsca!"}
                </p>
              </div>
            )}

            {/* Place list */}
            {(mode === "solo" ? likedPlaces : groupMatches).length > 0 && (
              <div className="space-y-2">
                {(mode === "solo" ? likedPlaces : groupMatches).map((place, i) => (
                  <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
                    <span className="h-7 w-7 rounded-full bg-orange-600/10 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                      {i + 1}
                    </span>
                    <img src={place.photo} alt={place.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upsell */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-600/10 to-orange-500/5 border border-orange-600/20 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-600" />
                <p className="font-bold text-base">Spodobało się?</p>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>✓ Paruj miejsca razem ze znajomymi</li>
                <li>✓ Nieograniczone kategorie i rundy</li>
                <li>✓ Zapisz trasę i nawiguj po niej</li>
                <li>✓ Historia wszystkich wspólnych planów</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0 px-4 pb-8 pt-3 space-y-2">
            <button
              onClick={() => navigate("/auth")}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/20"
            >
              Załóż konto — zajmuje 30 sekund →
            </button>
            <button
              onClick={() => { setStep("category"); setCategory(null); setLikedPlaces([]); setGroupReactions({}); setOtherDeviceDone(false); }}
              className="w-full py-3 rounded-2xl border border-border/50 text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
            >
              Spróbuj innej kategorii
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
