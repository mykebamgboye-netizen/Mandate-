/* MANDATE — real geography, one row per state + the FCT.
   The desk names real places (Section 32: people, parties, papers and firms are fictional;
   places, statutes and institutions are real). So when the player takes Kano, the market,
   the road, the rally town and the senatorial districts on the files are Kano's.

   towns     — three real secondary towns/areas the files can name (capital comes from
               federation_states, so the seat itself is never repeated here)
   districts — the state's three real senatorial districts (the FCT's one, per the 1999
               Constitution's delimitation)
   councils  — how many LGAs (or, for the FCT, area councils) the state actually has
*/

export interface Places {
  towns: string[]
  districts: string[]
  councils: number
  /** oil-mineral producing state (the derivation states of s.162(2)) — decides whether the
      security digest opens with a pipeline item or a trunk-road one */
  oil?: boolean
}

export const PLACES: Record<string, Places> = {
  AB: { towns: ['Aba', 'Ohafia', 'Arochukwu'], districts: ['Abia North', 'Abia Central', 'Abia South'], councils: 17, oil: true },
  AD: { towns: ['Mubi', 'Numan', 'Ganye'], districts: ['Adamawa North', 'Adamawa Central', 'Adamawa South'], councils: 21 },
  AK: { towns: ['Eket', 'Ikot Ekpene', 'Oron'], districts: ['Akwa Ibom North-East', 'Akwa Ibom North-West', 'Akwa Ibom South'], councils: 31, oil: true },
  AN: { towns: ['Onitsha', 'Nnewi', 'Aguata'], districts: ['Anambra North', 'Anambra Central', 'Anambra South'], councils: 21 },
  BA: { towns: ['Azare', 'Misau', 'Ningi'], districts: ['Bauchi North', 'Bauchi Central', 'Bauchi South'], councils: 20 },
  BY: { towns: ['Brass', 'Ogbia', 'Sagbama'], districts: ['Bayelsa East', 'Bayelsa Central', 'Bayelsa West'], councils: 8, oil: true },
  BE: { towns: ['Gboko', 'Otukpo', 'Katsina-Ala'], districts: ['Benue North-East', 'Benue North-West', 'Benue South'], councils: 23 },
  BO: { towns: ['Biu', 'Bama', 'Dikwa'], districts: ['Borno North', 'Borno Central', 'Borno South'], councils: 27 },
  CR: { towns: ['Ogoja', 'Ikom', 'Obudu'], districts: ['Cross River North', 'Cross River Central', 'Cross River South'], councils: 18, oil: true },
  DT: { towns: ['Warri', 'Sapele', 'Ughelli'], districts: ['Delta North', 'Delta Central', 'Delta South'], councils: 25, oil: true },
  EB: { towns: ['Afikpo', 'Onueke', 'Uburu'], districts: ['Ebonyi North', 'Ebonyi Central', 'Ebonyi South'], councils: 13 },
  ED: { towns: ['Auchi', 'Ekpoma', 'Uromi'], districts: ['Edo North', 'Edo Central', 'Edo South'], councils: 18, oil: true },
  EK: { towns: ['Ikere-Ekiti', 'Ijero-Ekiti', 'Omuo-Ekiti'], districts: ['Ekiti North', 'Ekiti Central', 'Ekiti South'], councils: 16 },
  EN: { towns: ['Nsukka', 'Oji River', 'Awgu'], districts: ['Enugu East', 'Enugu North', 'Enugu West'], councils: 17 },
  GO: { towns: ['Kaltungo', 'Billiri', 'Dukku'], districts: ['Gombe North', 'Gombe Central', 'Gombe South'], councils: 11 },
  IM: { towns: ['Orlu', 'Okigwe', 'Mbaise'], districts: ['Imo East', 'Imo North', 'Imo West'], councils: 27, oil: true },
  JI: { towns: ['Hadejia', 'Gumel', 'Birnin Kudu'], districts: ['Jigawa North-East', 'Jigawa North-West', 'Jigawa South-West'], councils: 27 },
  KD: { towns: ['Zaria', 'Kafanchan', 'Kagoro'], districts: ['Kaduna North', 'Kaduna Central', 'Kaduna South'], councils: 23 },
  KN: { towns: ['Wudil', 'Gaya', 'Dambatta'], districts: ['Kano North', 'Kano Central', 'Kano South'], councils: 44 },
  KT: { towns: ['Daura', 'Funtua', 'Malumfashi'], districts: ['Katsina North', 'Katsina Central', 'Katsina South'], councils: 34 },
  KE: { towns: ['Argungu', 'Yauri', 'Zuru'], districts: ['Kebbi North', 'Kebbi Central', 'Kebbi South'], councils: 21 },
  KO: { towns: ['Okene', 'Idah', 'Kabba'], districts: ['Kogi East', 'Kogi Central', 'Kogi West'], councils: 21 },
  KW: { towns: ['Offa', 'Omu-Aran', 'Kaiama'], districts: ['Kwara North', 'Kwara Central', 'Kwara South'], councils: 16 },
  LA: { towns: ['Badagry', 'Epe', 'Ikorodu'], districts: ['Lagos East', 'Lagos Central', 'Lagos West'], councils: 20 },
  NA: { towns: ['Keffi', 'Akwanga', 'Karu'], districts: ['Nasarawa North', 'Nasarawa West', 'Nasarawa South'], councils: 13 },
  NI: { towns: ['Bida', 'Suleja', 'Kontagora'], districts: ['Niger East', 'Niger North', 'Niger South'], councils: 25 },
  OG: { towns: ['Sagamu', 'Ijebu-Ode', 'Ilaro'], districts: ['Ogun East', 'Ogun Central', 'Ogun West'], councils: 20 },
  ON: { towns: ['Ondo', 'Ikare', 'Owo'], districts: ['Ondo North', 'Ondo Central', 'Ondo South'], councils: 18, oil: true },
  OS: { towns: ['Ile-Ife', 'Ilesa', 'Ede'], districts: ['Osun East', 'Osun Central', 'Osun West'], councils: 30 },
  OY: { towns: ['Ogbomoso', 'Oyo', 'Iseyin'], districts: ['Oyo North', 'Oyo Central', 'Oyo South'], councils: 33 },
  PL: { towns: ['Bukuru', 'Pankshin', 'Shendam'], districts: ['Plateau North', 'Plateau Central', 'Plateau South'], councils: 17 },
  RI: { towns: ['Bonny', 'Eleme', 'Bori'], districts: ['Rivers East', 'Rivers South-East', 'Rivers West'], councils: 23, oil: true },
  SO: { towns: ['Tambuwal', 'Illela', 'Bodinga'], districts: ['Sokoto East', 'Sokoto North', 'Sokoto South'], councils: 23 },
  TA: { towns: ['Wukari', 'Bali', 'Serti'], districts: ['Taraba North', 'Taraba Central', 'Taraba South'], councils: 16 },
  YO: { towns: ['Potiskum', 'Gashua', 'Nguru'], districts: ['Yobe East', 'Yobe North', 'Yobe South'], councils: 17 },
  ZA: { towns: ['Kaura Namoda', 'Talata Mafara', 'Anka'], districts: ['Zamfara North', 'Zamfara Central', 'Zamfara South'], councils: 14 },
  // The territory is one senatorial district and runs six area councils (s.299 + the
  // FCT Area Councils), not 774-style LGAs.
  FC: { towns: ['Gwagwalada', 'Bwari', 'Kuje'], districts: ['Federal Capital Territory'], councils: 6 },
}

/** The FCT's six area councils, in the order the register reads. */
export const FCT_AREA_COUNCILS = [
  'Abuja Municipal Area Council',
  'Gwagwalada',
  'Bwari',
  'Kuje',
  'Kwali',
  'Abaji',
]

export function placesFor(stateCode: string | null): Places {
  if (!stateCode) return { towns: [], districts: [], councils: 0 }
  return PLACES[stateCode] ?? { towns: [], districts: [], councils: 0 }
}
