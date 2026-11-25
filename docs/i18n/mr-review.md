# Marathi (मराठी) review: the 40 most visible strings

GEN-2609-120, dispatch J. For Hitesh's native read, on a phone, with the app set to मराठी (globe button in the top bar → मराठी).

Aim was everyday Marathi as spoken in Pune: not Sanskritised, not the Hindi copied over. Common English loanwords are kept the way people say them (इव्हेंट, बुकिंग, प्रोफाइल, डॅशबोर्ड, सीट), and brand and product terms stay as Hindi has them (AforAudience, AFA code, OTP, UPI, Razorpay). City names and ₹ amounts are never translated.

Mark anything that reads wrong or stiff and say what you'd write instead. Every string lives in `src/lib/i18n/dictionaries/mr.ts` under the key shown.

| # | Where | English | Marathi | Key |
|---|---|---|---|---|
| 1 | Nav | Events | इव्हेंट्स | `nav.events` |
| 2 | Nav | Artists | कलाकार | `nav.artists` |
| 3 | Nav | Venues | ठिकाणे | `nav.venues` |
| 4 | Nav | Wall of Fame | वॉल ऑफ फेम | `nav.wallOfFame` |
| 5 | Nav | My Tickets | माझी तिकिटे | `nav.myTickets` |
| 6 | Nav | Messages | मेसेज | `nav.messages` |
| 7 | Nav | Profile | प्रोफाइल | `nav.profile` |
| 8 | Nav | Sign in | साइन इन करा | `nav.signIn` |
| 9 | Nav | Sign up | साइन अप करा | `nav.signUp` |
| 10 | Nav | Hi, | नमस्कार, | `nav.greeting` |
| 11 | Phone tab bar | Discover | शोधा | `nav.tabDiscover` |
| 12 | Phone tab bar | Tickets | तिकिटे | `nav.tabTickets` |
| 13 | Phone tab bar | Saved | आवडते | `nav.tabSaved` |
| 14 | Phone tab bar | WOF (Wall of Fame) | फेम | `nav.tabWallOfFame` |
| 15 | Search | Search events, artists, venues... | इव्हेंट्स, कलाकार, ठिकाणे शोधा... | `search.placeholder` |
| 16 | Event cards | Sold Out | हाऊसफुल | `availability.sold-out` |
| 17 | Event cards | Filling Fast | पटापट भरत आहे | `availability.filling-fast` |
| 18 | Event cards / filters | Free | मोफत | `eventsPage.filterFree` |
| 19 | Events page | {n} events happening near you | तुमच्या जवळ {n} इव्हेंट्स होत आहेत | `eventsPage.countNear` |
| 20 | Events page | Tonight in {city} | आज रात्री {city} मध्ये | `eventsPage.discoverTonightInCityHeading` |
| 21 | Event page | Choose your seats | तुमच्या सीट्स निवडा | `eventDetailPage.chooseSeats` |
| 22 | Event page | Booking fee | बुकिंग फी | `eventDetailPage.bookingFeeLabel` |
| 23 | Event page | Continue to Checkout | चेकआउटकडे पुढे | `eventDetailPage.continueToCheckout` |
| 24 | Event page | Confirm Free Booking | मोफत बुकिंग कन्फर्म करा | `eventDetailPage.confirmFreeBooking` |
| 25 | Event page | Sign in to reserve your seats | सीट्स राखून ठेवण्यासाठी साइन इन करा | `eventDetailPage.signInToReserve` |
| 26 | Checkout | Confirm your booking | तुमचे बुकिंग कन्फर्म करा | `checkoutPage.confirmYourBooking` |
| 27 | Checkout | Reserve seats now — pay in the next 15 minutes to lock them in. | आत्ता सीट्स राखून ठेवा — पक्क्या करण्यासाठी पुढच्या 15 मिनिटांत पैसे भरा. | `checkoutPage.reserveSeatsNotice` |
| 28 | Checkout | Pay | भरा | `checkoutPage.payPrefix` |
| 29 | Checkout | You're in! | तुमची जागा पक्की! | `checkoutPage.youreIn` |
| 30 | Checkout | Download ticket (PDF) | तिकीट डाउनलोड करा (PDF) | `checkoutPage.downloadTicketPdf` |
| 31 | Tickets | Your passes, ready to scan | तुमचे पास, स्कॅनसाठी तयार | `ticketsPage.pageKicker` |
| 32 | Tickets | Scan at door | दारावर स्कॅन करा | `ticketsPage.scanAtDoor` |
| 33 | Tickets | Pay now → | आता पैसे भरा → | `ticketsPage.payNowArrow` |
| 34 | Tickets | Cancel ticket | तिकीट रद्द करा | `ticketsPage.cancelTicketButton` |
| 35 | Tickets | Download PDF | PDF डाउनलोड | `ticketsPage.downloadPdfShort` |
| 36 | Tickets | Reserved — pay to confirm | राखीव — कन्फर्म करण्यासाठी पैसे भरा | `bookingStatus.PENDING` |
| 37 | Tickets | Confirmed | कन्फर्म | `bookingStatus.CONFIRMED` |
| 38 | Banner | Verify your phone number to book tickets or venues. | तिकिटे किंवा ठिकाणे बुक करण्यासाठी तुमचा फोन नंबर व्हेरिफाय करा. | `phoneVerifyNudge.message` |
| 39 | Banner | Verify now | आता व्हेरिफाय करा | `phoneVerifyNudge.verifyNow` |
| 40 | Login | Use OTP instead | त्याऐवजी OTP वापरा | `loginPage.useOtpInstead` |

## Choices worth a second look

- **Venues → ठिकाणे** (not स्थळ / व्हेन्यू). Felt most natural for "where the show is"; venue owner is ठिकाण मालक.
- **Sold Out → हाऊसफुल**: what Pune theatre boards say. Swap to "सगळी तिकिटे संपली" if it reads too filmy.
- **Saved → आवडते** (favourites) for the tab bar: "सेव्ह केलेले" is more literal but did not fit the slot.
- **Theater → नाटक**, as the event type; Theatre the building stays थिएटर where it appears.
- **Verify → व्हेरिफाय करा**, as people say it; the formal alternative is पडताळणी करा.
- Polite plural (तुम्ही / करा) throughout, as in Hindi's आप.
