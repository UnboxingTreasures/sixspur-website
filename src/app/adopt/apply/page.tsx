"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
  "Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico",
  "New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const PHONE_TYPES = ["Mobile","Home","Work","Other"];

const TOPICS = [
  "Feeding this pet",
  "House/Litterbox training",
  "Grooming/Nail trimming",
  "Exercise, toys, and other fun activities",
  "Working with a trainer",
  "Microchips and other ID options",
  "Finding a veterinarian",
];

const OTHER_PETS = [
  "We have one or more dog(s)",
  "We have one or more cat(s)",
  "We have one or more small animal(s)",
  "We have one or more large animal(s)",
  "I'm interested in information on introducing a new pet to my pet(s) in the household",
];

const inputClass = "w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400 bg-white";
const labelClass = "block text-sm font-semibold text-spur-black mb-1";
const hintClass = "text-xs text-gray-500 mb-2";
const requiredStar = <span className="text-spur-orange">*</span>;
const optionalTag = <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>;

function AdoptApplyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const animalParam = searchParams.get("animal") || "";
  // NEW Session 18 -- the actual animalId, so the backend can reliably
  // link this application back to a specific adoptable_animals record
  // (used by adminAdoptions to auto-mark the animal adopted on
  // approval). animalParam (the animal's NAME) stays as the
  // human-readable label shown throughout this form and in emails/PDF;
  // animalId is the new machine-readable link, nullable for robustness
  // in case an old link is missing it.
  const animalIdParam = searchParams.get("animalId") || "";

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Applications must always be tied to a specific adoptable animal --
  // no general/someday application. If someone lands here without an
  // ?animal= param (typed the URL directly, old bookmark, etc.), send
  // them to the animal listing instead of showing the form at all.
  useEffect(() => {
    if (!animalParam) {
      router.replace("/adopt");
    }
  }, [animalParam, router]);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partner, setPartner] = useState("");
  const [street, setStreet] = useState("");
  const [apt, setApt] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [zip, setZip] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [primaryPhoneType, setPrimaryPhoneType] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [secondaryPhoneType, setSecondaryPhoneType] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [interestedIn, setInterestedIn] = useState(animalParam);

  // Step 2
  const [adoptOrFoster, setAdoptOrFoster] = useState<string[]>([]);
  const [employment, setEmployment] = useState("");
  const [household, setHousehold] = useState("");
  const [childrenAges, setChildrenAges] = useState("");
  const [otherPets, setOtherPets] = useState<string[]>([]);
  const [otherPetsDetail, setOtherPetsDetail] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [petUse, setPetUse] = useState("");
  const [livestockExp, setLivestockExp] = useState("");
  const [keptAt, setKeptAt] = useState("");
  const [yardFenced, setYardFenced] = useState("");
  const [fencePhotos, setFencePhotos] = useState<FileList | null>(null);
  const [siteVisit, setSiteVisit] = useState("");
  const [barnRoutine, setBarnRoutine] = useState("");
  const [reliableTransport, setReliableTransport] = useState("");
  const [careWhenAway, setCareWhenAway] = useState("");
  const [vet, setVet] = useState("");
  const [references, setReferences] = useState("");
  const [additional, setAdditional] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToReturn, setAgreedToReturn] = useState(false);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    if (animalParam) setInterestedIn(animalParam);
  }, [animalParam]);

  const toggleCheck = (val: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);
  };

  const validateStep1 = () => {
    const errs: string[] = [];
    if (!firstName.trim()) errs.push("First name is required.");
    if (!lastName.trim()) errs.push("Last name is required.");
    if (!street.trim()) errs.push("Street address is required.");
    if (!city.trim()) errs.push("City is required.");
    if (!state) errs.push("State is required.");
    if (!zip.trim()) errs.push("Zip code is required.");
    if (!primaryPhone.trim()) errs.push("Primary phone is required.");
    if (!primaryPhoneType) errs.push("Primary phone type is required.");
    if (!primaryEmail.trim()) errs.push("Primary email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) errs.push("Please enter a valid email address.");
    if (!interestedIn.trim()) errs.push("Please tell us which animals you are interested in.");
    setErrors(errs);
    return errs.length === 0;
  };

  const validateStep2 = () => {
    const errs: string[] = [];
    if (adoptOrFoster.length === 0) errs.push("Please indicate if you are looking to adopt or foster.");
    if (!employment.trim()) errs.push("Employment information is required.");
    if (!household.trim()) errs.push("Please describe the members of your household.");
    if (!petUse.trim()) errs.push("Please tell us what the pet will be used for.");
    if (!livestockExp.trim()) errs.push("Please answer the livestock experience question.");
    if (!keptAt.trim()) errs.push("Please tell us where the animal will be kept.");
    if (!yardFenced) errs.push("Please indicate whether your yard is fenced.");
    if (!siteVisit) errs.push("Please answer the site visit question.");
    if (!barnRoutine.trim()) errs.push("Please describe your daily animal care routine.");
    if (!reliableTransport) errs.push("Please indicate whether you have reliable transportation for vet visits.");
    if (!careWhenAway.trim()) errs.push("Please tell us who will care for the animal when you are away.");
    if (!vet.trim()) errs.push("Veterinarian information is required.");
    if (!references.trim()) errs.push("Please provide 3 non-familial references.");
    if (!agreedToTerms) errs.push("You must agree to the terms and conditions.");
    if (!agreedToReturn) errs.push("You must agree to the return policy.");
    if (!signature.trim()) errs.push("Signature is required.");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleContinue = () => {
    if (validateStep1()) {
      setErrors([]);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    try {
      setSubmitting(true);

      const fenceFiles = fencePhotos ? Array.from(fencePhotos) : [];
      let applicationId: string | undefined;
      let fencePhotoKeys: string[] = [];

      // Step 1: if there are fence photos, get presigned upload URLs first
      // and upload them BEFORE submitting the application — the backend
      // needs the photos to already exist in S3 so it can embed them in
      // the generated PDF.
      if (fenceFiles.length > 0) {
        const presignRes = await fetch(`${API_URL}/adopt/photos/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileNames: fenceFiles.map((f) => f.name) }),
        });

        if (!presignRes.ok) {
          throw new Error("Failed to prepare photo upload. Please try again.");
        }

        const presignData = await presignRes.json();
        applicationId = presignData.applicationId;

        await Promise.all(
          presignData.uploads.map((upload: { fileName: string; uploadUrl: string; key: string }) => {
            const file = fenceFiles.find((f) => f.name === upload.fileName);
            if (!file) return Promise.resolve();
            return fetch(upload.uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
            });
          })
        );

        fencePhotoKeys = presignData.uploads.map((u: { key: string }) => u.key);
      }

      // Step 2: submit the full application — photos (if any) are already
      // in S3 by now, so the backend can fetch and embed them in the PDF.
      const payload = {
        applicationId,
        animalId: animalIdParam || undefined,
        firstName, lastName, partner,
        street, apt, city, state, county, zip,
        primaryPhone, primaryPhoneType, secondaryPhone, secondaryPhoneType,
        primaryEmail, secondaryEmail, interestedIn,
        adoptOrFoster, employment, household, childrenAges,
        otherPets, otherPetsDetail, topics,
        petUse, livestockExp, keptAt, yardFenced,
        fencePhotoCount: fenceFiles.length,
        fencePhotoKeys,
        siteVisit, barnRoutine, reliableTransport, careWhenAway,
        vet, references, additional,
        agreedToTerms, agreedToReturn, signature,
      };

      const res = await fetch(`${API_URL}/adopt/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  };

  if (!animalParam) {
    // Redirect is already triggered by the effect above -- this just
    // avoids rendering the full form for a split second while that
    // happens.
    return <main className="min-h-screen bg-white" />;
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-white">
        <section className="bg-spur-black text-white py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="eyebrow mb-3">Adopt</p>
            <h1 className="text-4xl font-bold">Application Submitted</h1>
          </div>
        </section>
        <section className="py-24 px-6">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-full bg-spur-orange-light flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-spur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-spur-black mb-3">Thank You!</h2>
            <p className="text-gray-600 leading-relaxed">
              We've received your adoption application and will review it carefully. Please remember
              that submitting an application does not reserve a specific animal. We'll be in touch soon.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Adopt</p>
          <h1 className="text-4xl font-bold mb-2">Apply for Adoption</h1>
          {animalParam && <p className="text-spur-orange font-semibold">{animalParam}</p>}
          <div className="flex items-center gap-3 mt-6">
            {["Contact Information", "Questions"].map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-sm font-semibold ${step === i + 1 ? "text-spur-orange" : "text-white/40"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step === i + 1 ? "border-spur-orange text-spur-orange" : "border-white/20 text-white/30"}`}>
                    {i + 1}
                  </span>
                  {label}
                </div>
                {i === 0 && <span className="text-white/20">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">

          {errors.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm space-y-1">
              {errors.map((e) => <p key={e}>• {e}</p>)}
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-spur-black">Your Contact Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>First Name {requiredStar}</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name {requiredStar}</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Spouse / Partner / Roommate to Put on Record {optionalTag}</label>
                <input value={partner} onChange={(e) => setPartner(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Street Address {requiredStar}</label>
                <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Apt / Unit # {optionalTag}</label>
                <input value={apt} onChange={(e) => setApt(e.target.value)} className={inputClass} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>City {requiredStar}</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State {requiredStar}</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                    <option value="">Select a state</option>
                    {US_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>County {optionalTag}</label>
                  <input value={county} onChange={(e) => setCounty(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Zip / Postal Code {requiredStar}</label>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Primary Phone {requiredStar}</label>
                  <input value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} type="tel" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone Type {requiredStar}</label>
                  <select value={primaryPhoneType} onChange={(e) => setPrimaryPhoneType(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {PHONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Secondary Phone {optionalTag}</label>
                  <input value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} type="tel" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone Type</label>
                  <select value={secondaryPhoneType} onChange={(e) => setSecondaryPhoneType(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {PHONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Primary Email Address {requiredStar}</label>
                <input value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} type="email" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Secondary Email Address {optionalTag}</label>
                <input value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} type="email" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Which animal are you interested in?</label>
                <div className={inputClass + " bg-spur-tan-light cursor-not-allowed text-gray-600"}>
                  {interestedIn}
                </div>
                <p className={hintClass}>This application is for {interestedIn}. Want to apply for a different animal? <a href="/adopt" className="text-spur-orange hover:underline">Browse adoptable animals</a>.</p>
              </div>

              <div className="pt-4 flex justify-end">
                <button onClick={handleContinue} className="bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-8">
              <button onClick={() => { setStep(1); setErrors([]); window.scrollTo({ top: 0 }); }} className="text-spur-orange text-sm font-semibold hover:underline">
                ← Go Back
              </button>

              <h2 className="text-xl font-bold text-spur-black">Questions</h2>

              {/* Adopt or foster */}
              <div>
                <label className={labelClass}>Are you looking to adopt or foster? {requiredStar}</label>
                {["Adopt","Foster"].map((opt) => (
                  <label key={opt} className="flex items-center gap-3 mb-2 cursor-pointer">
                    <input type="checkbox" checked={adoptOrFoster.includes(opt)} onChange={() => toggleCheck(opt, adoptOrFoster, setAdoptOrFoster)} className="w-4 h-4 accent-spur-orange" />
                    <span className="text-sm text-spur-black">{opt}</span>
                  </label>
                ))}
              </div>

              {/* Employment */}
              <div>
                <label className={labelClass}>Employment Information {requiredStar}</label>
                <p className={hintClass}>Please provide your current employer, address, phone number, email, position, and number of years employed.</p>
                <textarea value={employment} onChange={(e) => setEmployment(e.target.value)} rows={4} className={inputClass + " resize-none"} />
              </div>

              {/* Household */}
              <div>
                <label className={labelClass}>Please tell us about the members of your household. {requiredStar}</label>
                <p className={hintClass}>Include the number of adults, senior citizens, and any young children in the home.</p>
                <textarea value={household} onChange={(e) => setHousehold(e.target.value)} rows={3} className={inputClass + " resize-none"} />
              </div>

              {/* Children ages */}
              <div>
                <label className={labelClass}>If there are children in the home, please list their ages. {optionalTag}</label>
                <input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 4, 8, 12" className={inputClass} />
              </div>

              {/* Other pets */}
              <div>
                <label className={labelClass}>Please tell us about any other pets currently in your household.</label>
                <p className={hintClass}>Check all that apply.</p>
                {OTHER_PETS.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 mb-2 cursor-pointer">
                    <input type="checkbox" checked={otherPets.includes(opt)} onChange={() => toggleCheck(opt, otherPets, setOtherPets)} className="w-4 h-4 accent-spur-orange" />
                    <span className="text-sm text-spur-black">{opt}</span>
                  </label>
                ))}
                {otherPets.length > 0 && (
                  <div className="mt-3">
                    <label className={labelClass}>Please list the species and approximate number of each. {optionalTag}</label>
                    <input value={otherPetsDetail} onChange={(e) => setOtherPetsDetail(e.target.value)} placeholder="e.g. 2 dogs, 1 cat, 3 chickens" className={inputClass} />
                  </div>
                )}
              </div>

              {/* Topics */}
              <div>
                <label className={labelClass}>We will walk you through this animal's medical and behavioral history. Are there any additional topics you'd like to discuss?</label>
                <p className={hintClass}>Check all that apply.</p>
                {TOPICS.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 mb-2 cursor-pointer">
                    <input type="checkbox" checked={topics.includes(opt)} onChange={() => toggleCheck(opt, topics, setTopics)} className="w-4 h-4 accent-spur-orange" />
                    <span className="text-sm text-spur-black">{opt}</span>
                  </label>
                ))}
              </div>

              {/* Pet use */}
              <div>
                <label className={labelClass}>What role will this animal play in your home or on your property? {requiredStar}</label>
                <input value={petUse} onChange={(e) => setPetUse(e.target.value)} placeholder="e.g. Companion animal, working animal, livestock" className={inputClass} />
              </div>

              {/* Livestock experience */}
              <div>
                <label className={labelClass}>Have you previously owned livestock or farm animals? {requiredStar}</label>
                <p className={hintClass}>If yes, please include the type of animal and how many years of experience you have.</p>
                <input value={livestockExp} onChange={(e) => setLivestockExp(e.target.value)} className={inputClass} />
              </div>

              {/* Where kept */}
              <div>
                <label className={labelClass}>Where will the animal be kept? {requiredStar}</label>
                <p className={hintClass}>Please provide the full address (street, city, state, zip). If the animal will not be kept at your primary residence, also include the facility name, contact information, and a brief description of the property.</p>
                <textarea value={keptAt} onChange={(e) => setKeptAt(e.target.value)} rows={4} className={inputClass + " resize-none"} />
              </div>

              {/* Yard fenced */}
              <div>
                <label className={labelClass}>Is the area where the animal will be kept fenced? {requiredStar}</label>
                <select value={yardFenced} onChange={(e) => setYardFenced(e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="Yes — fully fenced">Yes — fully fenced</option>
                  <option value="Yes — partially fenced">Yes — partially fenced</option>
                  <option value="No">No</option>
                </select>
                {yardFenced && yardFenced !== "No" && (
                  <div className="mt-4">
                    <label className={labelClass}>Please upload photos of the enclosure where the animal will be kept. {optionalTag}</label>
                    <p className={hintClass}>You may upload multiple photos. Accepted formats: JPG, PNG, HEIC.</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/heif"
                      multiple
                      onChange={(e) => setFencePhotos(e.target.files)}
                      className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-spur-orange file:text-white hover:file:bg-spur-orange-dark file:cursor-pointer cursor-pointer"
                    />
                    {fencePhotos && fencePhotos.length > 0 && (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        {fencePhotos.length} photo{fencePhotos.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Site visit */}
              <div>
                <label className={labelClass}>Do you agree to a site visit at the location where the animal will be kept? {requiredStar}</label>
                <select value={siteVisit} onChange={(e) => setSiteVisit(e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* Daily routine */}
              <div>
                <label className={labelClass}>Please describe your daily animal care routine. {requiredStar}</label>
                <p className={hintClass}>Include feeding schedule, turnout time, exercise, and any other relevant details.</p>
                <textarea value={barnRoutine} onChange={(e) => setBarnRoutine(e.target.value)} rows={4} className={inputClass + " resize-none"} />
              </div>

              {/* Reliable transport */}
              <div>
                <label className={labelClass}>Do you have reliable transportation available to bring this animal to veterinary appointments? {requiredStar}</label>
                <select value={reliableTransport} onChange={(e) => setReliableTransport(e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No — I would make alternative arrangements">No — I would make alternative arrangements</option>
                </select>
              </div>

              {/* Care when away */}
              <div>
                <label className={labelClass}>Who will care for the animal when you are away or unavailable? {requiredStar}</label>
                <input value={careWhenAway} onChange={(e) => setCareWhenAway(e.target.value)} className={inputClass} />
              </div>

              {/* Vet */}
              <div>
                <label className={labelClass}>Your Veterinarian {requiredStar}</label>
                <p className={hintClass}>Please include the veterinarian's name, clinic name, address, phone number, email, and how long you have used their services.</p>
                <textarea value={vet} onChange={(e) => setVet(e.target.value)} rows={4} className={inputClass + " resize-none"} />
              </div>

              {/* References */}
              <div>
                <label className={labelClass}>Please list three non-family references. {requiredStar}</label>
                <p className={hintClass}>Include each person's name, address, phone number, and email.</p>
                <textarea value={references} onChange={(e) => setReferences(e.target.value)} rows={5} className={inputClass + " resize-none"} />
              </div>

              {/* Additional */}
              <div>
                <label className={labelClass}>Is there anything else you'd like us to know, or any questions you have for us? {optionalTag}</label>
                <textarea value={additional} onChange={(e) => setAdditional(e.target.value)} rows={4} className={inputClass + " resize-none"} />
              </div>

              {/* Disclaimer */}
              <div className="border-t border-spur-tan-light pt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-spur-black mb-2">Disclaimer</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Thank you so much for your interest in giving an animal a loving home. Please keep in mind that while we review every application with great care, submitting an application does not reserve or guarantee placement of a specific animal.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="w-4 h-4 mt-0.5 accent-spur-orange flex-shrink-0" />
                  <span className="text-sm text-spur-black">
                    I have read and agree to the{" "}
                    <a href="/privacy" className="text-spur-orange hover:underline">Terms and Conditions</a>.{" "}
                    {requiredStar}
                  </span>
                </label>

                {/* Return agreement */}
                <div className="bg-spur-tan-light rounded p-4 border border-spur-tan">
                  <h4 className="text-sm font-bold text-spur-black mb-2">Return Policy Agreement</h4>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    If at any time you find yourself unable to provide adequate care for this animal — due to changes in living situation, financial circumstances, health, or any other reason — you agree to contact Six Spur Ranch and Rescue immediately to arrange the animal's return. Under no circumstances should the animal be surrendered to a shelter, sold, rehomed, or abandoned without first notifying Six Spur Ranch and Rescue.
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreedToReturn} onChange={(e) => setAgreedToReturn(e.target.checked)} className="w-4 h-4 mt-0.5 accent-spur-orange flex-shrink-0" />
                    <span className="text-sm text-spur-black">
                      I understand and agree to contact Six Spur Ranch and Rescue if I am ever unable to care for this animal, and to facilitate the animal's safe return to the rescue. {requiredStar}
                    </span>
                  </label>
                </div>

                {/* Signature */}
                <div>
                  <label className={labelClass}>Signature {requiredStar}</label>
                  <p className={hintClass}>By typing your full name below, you are signing this application and agreeing to all terms above.</p>
                  <textarea value={signature} onChange={(e) => setSignature(e.target.value)} rows={2}
                    placeholder="Type your full legal name"
                    className={inputClass + " resize-none"} />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button onClick={() => { setStep(1); setErrors([]); window.scrollTo({ top: 0 }); }} className="text-gray-500 text-sm hover:text-spur-black transition-colors">
                  ← Go Back
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50">
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>

            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function AdoptApplyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <AdoptApplyForm />
    </Suspense>
  );
}
