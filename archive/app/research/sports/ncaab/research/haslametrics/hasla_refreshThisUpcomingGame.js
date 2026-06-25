                         td2.innerHTML="<span style=\"color: #00a000;\">WIN</span>"; }
                      else {
                         td2.innerHTML="<span style=\"color: #a00000;\">LOSS</span>"; }

                      var td3=document.getElementById("tdAllplayTs" + Counter);
                      td3.innerHTML=parseFloat(Math.round(parseFloat(ts) * 100) / 100).toFixed(2);

                      var td4=document.getElementById("tdAllplayOs" + Counter);
                      td4.innerHTML=parseFloat(Math.round(parseFloat(os) * 100) / 100).toFixed(2);

                   }
                 }
               }
            }


            function refreshThisUpcomingGame(HomeTeam,HomeID,AwayTeam,AwayID,GameID,Site,GamePace,GameShooting,GameAPAvg,ListBy) {
                xmlDoc=xmlhttp.responseXML;
                xmlMR=xmlDoc.getElementsByTagName("mr");
                var MRlength;
                MRlength=xmlMR.length;
                xmlAV=xmlDoc.getElementsByTagName("av");
                xmlHA=xmlDoc.getElementsByTagName("ha");

                var av_u = Number(xmlAV[0].getAttribute('u'));
                var av_ftar = Number(xmlAV[0].getAttribute('ftar'));
                var av_fgar = Number(xmlAV[0].getAttribute('fgar'));
                var av_tpar = Number(xmlAV[0].getAttribute('tpar'));
                var av_npar = Number(xmlAV[0].getAttribute('npar'));
                var av_fpar = Number(xmlAV[0].getAttribute('fpar'));
                var av_fgmr = Number(xmlAV[0].getAttribute('fgmr'));
                var av_tpmr = Number(xmlAV[0].getAttribute('tpmr'));
                var av_npmr = Number(xmlAV[0].getAttribute('npmr'));
                var av_fpmr = Number(xmlAV[0].getAttribute('fpmr'));
                var av_ftarb = Number(xmlAV[0].getAttribute('ftarb'));
                var av_fgarb = Number(xmlAV[0].getAttribute('fgarb'));
                var av_tparb = Number(xmlAV[0].getAttribute('tparb'));
                var av_nparb = Number(xmlAV[0].getAttribute('nparb'));
                var av_fparb = Number(xmlAV[0].getAttribute('fparb'));
                var av_fgmrb = Number(xmlAV[0].getAttribute('fgmrb'));
                var av_tpmrb = Number(xmlAV[0].getAttribute('tpmrb'));
                var av_npmrb = Number(xmlAV[0].getAttribute('npmrb'));
                var av_fpmrb = Number(xmlAV[0].getAttribute('fpmrb'));
                var av_ftarsc = Number(xmlAV[0].getAttribute('ftarsc'));
                var av_fgarsc = Number(xmlAV[0].getAttribute('fgarsc'));
                var av_tparsc = Number(xmlAV[0].getAttribute('tparsc'));
                var av_nparsc = Number(xmlAV[0].getAttribute('nparsc'));
                var av_fparsc = Number(xmlAV[0].getAttribute('fparsc'));
                var av_fgmrsc = Number(xmlAV[0].getAttribute('fgmrsc'));
                var av_tpmrsc = Number(xmlAV[0].getAttribute('tpmrsc'));
                var av_npmrsc = Number(xmlAV[0].getAttribute('npmrsc'));
                var av_fpmrsc = Number(xmlAV[0].getAttribute('fpmrsc'));
                var av_ftarsd = Number(xmlAV[0].getAttribute('ftarsd'));
                var av_fgarsd = Number(xmlAV[0].getAttribute('fgarsd'));
                var av_tparsd = Number(xmlAV[0].getAttribute('tparsd'));
                var av_nparsd = Number(xmlAV[0].getAttribute('nparsd'));
                var av_fparsd = Number(xmlAV[0].getAttribute('fparsd'));
                var av_fgmrsd = Number(xmlAV[0].getAttribute('fgmrsd'));
                var av_tpmrsd = Number(xmlAV[0].getAttribute('tpmrsd'));
                var av_npmrsd = Number(xmlAV[0].getAttribute('npmrsd'));
                var av_fpmrsd = Number(xmlAV[0].getAttribute('fpmrsd'));

                var ha_u = Number(xmlHA[0].getAttribute('u'));
                var ha_ftar = Number(xmlHA[0].getAttribute('ftar'));
                var ha_fgar = Number(xmlHA[0].getAttribute('fgar'));
                var ha_tpar = Number(xmlHA[0].getAttribute('tpar'));
                var ha_npar = Number(xmlHA[0].getAttribute('npar'));
                var ha_fpar = Number(xmlHA[0].getAttribute('fpar'));
                var ha_fgmr = Number(xmlHA[0].getAttribute('fgmr'));
                var ha_tpmr = Number(xmlHA[0].getAttribute('tpmr'));
                var ha_npmr = Number(xmlHA[0].getAttribute('npmr'));
                var ha_fpmr = Number(xmlHA[0].getAttribute('fpmr'));
                var ha_ftarb = Number(xmlHA[0].getAttribute('ftarb'));
                var ha_fgarb = Number(xmlHA[0].getAttribute('fgarb'));
                var ha_tparb = Number(xmlHA[0].getAttribute('tparb'));
                var ha_nparb = Number(xmlHA[0].getAttribute('nparb'));
                var ha_fparb = Number(xmlHA[0].getAttribute('fparb'));
                var ha_fgmrb = Number(xmlHA[0].getAttribute('fgmrb'));
                var ha_tpmrb = Number(xmlHA[0].getAttribute('tpmrb'));
                var ha_npmrb = Number(xmlHA[0].getAttribute('npmrb'));
                var ha_fpmrb = Number(xmlHA[0].getAttribute('fpmrb'));
                var ha_ftarsc = Number(xmlHA[0].getAttribute('ftarsc'));
                var ha_fgarsc = Number(xmlHA[0].getAttribute('fgarsc'));
                var ha_tparsc = Number(xmlHA[0].getAttribute('tparsc'));
                var ha_nparsc = Number(xmlHA[0].getAttribute('nparsc'));
                var ha_fparsc = Number(xmlHA[0].getAttribute('fparsc'));
                var ha_fgmrsc = Number(xmlHA[0].getAttribute('fgmrsc'));
                var ha_tpmrsc = Number(xmlHA[0].getAttribute('tpmrsc'));
                var ha_npmrsc = Number(xmlHA[0].getAttribute('npmrsc'));
                var ha_fpmrsc = Number(xmlHA[0].getAttribute('fpmrsc'));
                var ha_ftarsd = Number(xmlHA[0].getAttribute('ftarsd'));
                var ha_fgarsd = Number(xmlHA[0].getAttribute('fgarsd'));
                var ha_tparsd = Number(xmlHA[0].getAttribute('tparsd'));
                var ha_nparsd = Number(xmlHA[0].getAttribute('nparsd'));
                var ha_fparsd = Number(xmlHA[0].getAttribute('fparsd'));
                var ha_fgmrsd = Number(xmlHA[0].getAttribute('fgmrsd'));
                var ha_tpmrsd = Number(xmlHA[0].getAttribute('tpmrsd'));
                var ha_npmrsd = Number(xmlHA[0].getAttribute('npmrsd'));
                var ha_fpmrsd = Number(xmlHA[0].getAttribute('fpmrsd'));

                      var today_team1 = Number(xmlMR[HomeID].getAttribute('id'));
                      var mr_ou1 = Number(xmlMR[HomeID].getAttribute('ou'));
                      var mr_du1 = Number(xmlMR[HomeID].getAttribute('du'));

                      var mr_ftpct1 = Number(xmlMR[HomeID].getAttribute('ftpct'));
                      var mr_oftar1 = Number(xmlMR[HomeID].getAttribute('oftar'));
                      var mr_ofgar1 = Number(xmlMR[HomeID].getAttribute('ofgar'));
                      var mr_otpar1 = Number(xmlMR[HomeID].getAttribute('otpar'));
                      var mr_onpar1 = Number(xmlMR[HomeID].getAttribute('onpar'));
                      var mr_ofpar1 = Number(xmlMR[HomeID].getAttribute('ofpar'));
                      var mr_ofgmr1 = Number(xmlMR[HomeID].getAttribute('ofgmr'));
                      var mr_otpmr1 = Number(xmlMR[HomeID].getAttribute('otpmr'));
                      var mr_onpmr1 = Number(xmlMR[HomeID].getAttribute('onpmr'));
                      var mr_ofpmr1 = Number(xmlMR[HomeID].getAttribute('ofpmr'));
                      var mr_dftar1 = Number(xmlMR[HomeID].getAttribute('dftar'));
                      var mr_dfgar1 = Number(xmlMR[HomeID].getAttribute('dfgar'));
                      var mr_dtpar1 = Number(xmlMR[HomeID].getAttribute('dtpar'));
                      var mr_dnpar1 = Number(xmlMR[HomeID].getAttribute('dnpar'));
                      var mr_dfpar1 = Number(xmlMR[HomeID].getAttribute('dfpar'));
                      var mr_dfgmr1 = Number(xmlMR[HomeID].getAttribute('dfgmr'));
                      var mr_dtpmr1 = Number(xmlMR[HomeID].getAttribute('dtpmr'));
                      var mr_dnpmr1 = Number(xmlMR[HomeID].getAttribute('dnpmr'));
                      var mr_dfpmr1 = Number(xmlMR[HomeID].getAttribute('dfpmr'));

                      var mr_oftarb1 = Number(xmlMR[HomeID].getAttribute('oftarb'));
                      var mr_ofgarb1 = Number(xmlMR[HomeID].getAttribute('ofgarb'));
                      var mr_otparb1 = Number(xmlMR[HomeID].getAttribute('otparb'));
                      var mr_onparb1 = Number(xmlMR[HomeID].getAttribute('onparb'));
                      var mr_ofparb1 = Number(xmlMR[HomeID].getAttribute('ofparb'));
                      var mr_ofgmrb1 = Number(xmlMR[HomeID].getAttribute('ofgmrb'));
                      var mr_otpmrb1 = Number(xmlMR[HomeID].getAttribute('otpmrb'));
                      var mr_onpmrb1 = Number(xmlMR[HomeID].getAttribute('onpmrb'));
                      var mr_ofpmrb1 = Number(xmlMR[HomeID].getAttribute('ofpmrb'));
                      var mr_dftarb1 = Number(xmlMR[HomeID].getAttribute('dftarb'));
                      var mr_dfgarb1 = Number(xmlMR[HomeID].getAttribute('dfgarb'));
                      var mr_dtparb1 = Number(xmlMR[HomeID].getAttribute('dtparb'));
                      var mr_dnparb1 = Number(xmlMR[HomeID].getAttribute('dnparb'));
                      var mr_dfparb1 = Number(xmlMR[HomeID].getAttribute('dfparb'));
                      var mr_dfgmrb1 = Number(xmlMR[HomeID].getAttribute('dfgmrb'));
                      var mr_dtpmrb1 = Number(xmlMR[HomeID].getAttribute('dtpmrb'));
                      var mr_dnpmrb1 = Number(xmlMR[HomeID].getAttribute('dnpmrb'));
                      var mr_dfpmrb1 = Number(xmlMR[HomeID].getAttribute('dfpmrb'));

                      var mr_oftarsc1 = Number(xmlMR[HomeID].getAttribute('oftarsc'));
                      var mr_ofgarsc1 = Number(xmlMR[HomeID].getAttribute('ofgarsc'));
                      var mr_otparsc1 = Number(xmlMR[HomeID].getAttribute('otparsc'));
                      var mr_onparsc1 = Number(xmlMR[HomeID].getAttribute('onparsc'));
                      var mr_ofparsc1 = Number(xmlMR[HomeID].getAttribute('ofparsc'));
                      var mr_ofgmrsc1 = Number(xmlMR[HomeID].getAttribute('ofgmrsc'));
                      var mr_otpmrsc1 = Number(xmlMR[HomeID].getAttribute('otpmrsc'));
                      var mr_onpmrsc1 = Number(xmlMR[HomeID].getAttribute('onpmrsc'));
                      var mr_ofpmrsc1 = Number(xmlMR[HomeID].getAttribute('ofpmrsc'));
                      var mr_dftarsc1 = Number(xmlMR[HomeID].getAttribute('dftarsc'));
                      var mr_dfgarsc1 = Number(xmlMR[HomeID].getAttribute('dfgarsc'));
                      var mr_dtparsc1 = Number(xmlMR[HomeID].getAttribute('dtparsc'));
                      var mr_dnparsc1 = Number(xmlMR[HomeID].getAttribute('dnparsc'));
                      var mr_dfparsc1 = Number(xmlMR[HomeID].getAttribute('dfparsc'));
                      var mr_dfgmrsc1 = Number(xmlMR[HomeID].getAttribute('dfgmrsc'));
                      var mr_dtpmrsc1 = Number(xmlMR[HomeID].getAttribute('dtpmrsc'));
                      var mr_dnpmrsc1 = Number(xmlMR[HomeID].getAttribute('dnpmrsc'));
                      var mr_dfpmrsc1 = Number(xmlMR[HomeID].getAttribute('dfpmrsc'));

                      var mr_oftarsd1 = Number(xmlMR[HomeID].getAttribute('oftarsd'));
                      var mr_ofgarsd1 = Number(xmlMR[HomeID].getAttribute('ofgarsd'));
                      var mr_otparsd1 = Number(xmlMR[HomeID].getAttribute('otparsd'));
                      var mr_onparsd1 = Number(xmlMR[HomeID].getAttribute('onparsd'));
                      var mr_ofparsd1 = Number(xmlMR[HomeID].getAttribute('ofparsd'));
                      var mr_ofgmrsd1 = Number(xmlMR[HomeID].getAttribute('ofgmrsd'));
                      var mr_otpmrsd1 = Number(xmlMR[HomeID].getAttribute('otpmrsd'));
                      var mr_onpmrsd1 = Number(xmlMR[HomeID].getAttribute('onpmrsd'));
                      var mr_ofpmrsd1 = Number(xmlMR[HomeID].getAttribute('ofpmrsd'));
                      var mr_dftarsd1 = Number(xmlMR[HomeID].getAttribute('dftarsd'));
                      var mr_dfgarsd1 = Number(xmlMR[HomeID].getAttribute('dfgarsd'));
                      var mr_dtparsd1 = Number(xmlMR[HomeID].getAttribute('dtparsd'));
                      var mr_dnparsd1 = Number(xmlMR[HomeID].getAttribute('dnparsd'));
                      var mr_dfparsd1 = Number(xmlMR[HomeID].getAttribute('dfparsd'));
                      var mr_dfgmrsd1 = Number(xmlMR[HomeID].getAttribute('dfgmrsd'));
                      var mr_dtpmrsd1 = Number(xmlMR[HomeID].getAttribute('dtpmrsd'));
                      var mr_dnpmrsd1 = Number(xmlMR[HomeID].getAttribute('dnpmrsd'));
                      var mr_dfpmrsd1 = Number(xmlMR[HomeID].getAttribute('dfpmrsd'));

                      var today_team2 = Number(xmlMR[AwayID].getAttribute('id'));
                      var mr_ou2 = Number(xmlMR[AwayID].getAttribute('ou'));
                      var mr_du2 = Number(xmlMR[AwayID].getAttribute('du'));

                      var mr_ftpct2 = Number(xmlMR[AwayID].getAttribute('ftpct'));
                      var mr_oftar2 = Number(xmlMR[AwayID].getAttribute('oftar'));
                      var mr_ofgar2 = Number(xmlMR[AwayID].getAttribute('ofgar'));
                      var mr_otpar2 = Number(xmlMR[AwayID].getAttribute('otpar'));
                      var mr_onpar2 = Number(xmlMR[AwayID].getAttribute('onpar'));
                      var mr_ofpar2 = Number(xmlMR[AwayID].getAttribute('ofpar'));
                      var mr_ofgmr2 = Number(xmlMR[AwayID].getAttribute('ofgmr'));
                      var mr_otpmr2 = Number(xmlMR[AwayID].getAttribute('otpmr'));
                      var mr_onpmr2 = Number(xmlMR[AwayID].getAttribute('onpmr'));
                      var mr_ofpmr2 = Number(xmlMR[AwayID].getAttribute('ofpmr'));
                      var mr_dftar2 = Number(xmlMR[AwayID].getAttribute('dftar'));
                      var mr_dfgar2 = Number(xmlMR[AwayID].getAttribute('dfgar'));
                      var mr_dtpar2 = Number(xmlMR[AwayID].getAttribute('dtpar'));
                      var mr_dnpar2 = Number(xmlMR[AwayID].getAttribute('dnpar'));
                      var mr_dfpar2 = Number(xmlMR[AwayID].getAttribute('dfpar'));
                      var mr_dfgmr2 = Number(xmlMR[AwayID].getAttribute('dfgmr'));
                      var mr_dtpmr2 = Number(xmlMR[AwayID].getAttribute('dtpmr'));
                      var mr_dnpmr2 = Number(xmlMR[AwayID].getAttribute('dnpmr'));
                      var mr_dfpmr2 = Number(xmlMR[AwayID].getAttribute('dfpmr'));

                      var mr_oftarb2 = Number(xmlMR[AwayID].getAttribute('oftarb'));
                      var mr_ofgarb2 = Number(xmlMR[AwayID].getAttribute('ofgarb'));
                      var mr_otparb2 = Number(xmlMR[AwayID].getAttribute('otparb'));
                      var mr_onparb2 = Number(xmlMR[AwayID].getAttribute('onparb'));
                      var mr_ofparb2 = Number(xmlMR[AwayID].getAttribute('ofparb'));
                      var mr_ofgmrb2 = Number(xmlMR[AwayID].getAttribute('ofgmrb'));
                      var mr_otpmrb2 = Number(xmlMR[AwayID].getAttribute('otpmrb'));
                      var mr_onpmrb2 = Number(xmlMR[AwayID].getAttribute('onpmrb'));
                      var mr_ofpmrb2 = Number(xmlMR[AwayID].getAttribute('ofpmrb'));
                      var mr_dftarb2 = Number(xmlMR[AwayID].getAttribute('dftarb'));
                      var mr_dfgarb2 = Number(xmlMR[AwayID].getAttribute('dfgarb'));
                      var mr_dtparb2 = Number(xmlMR[AwayID].getAttribute('dtparb'));
                      var mr_dnparb2 = Number(xmlMR[AwayID].getAttribute('dnparb'));
                      var mr_dfparb2 = Number(xmlMR[AwayID].getAttribute('dfparb'));
                      var mr_dfgmrb2 = Number(xmlMR[AwayID].getAttribute('dfgmrb'));
                      var mr_dtpmrb2 = Number(xmlMR[AwayID].getAttribute('dtpmrb'));
                      var mr_dnpmrb2 = Number(xmlMR[AwayID].getAttribute('dnpmrb'));
                      var mr_dfpmrb2 = Number(xmlMR[AwayID].getAttribute('dfpmrb'));

                      var mr_oftarsc2 = Number(xmlMR[AwayID].getAttribute('oftarsc'));
                      var mr_ofgarsc2 = Number(xmlMR[AwayID].getAttribute('ofgarsc'));
                      var mr_otparsc2 = Number(xmlMR[AwayID].getAttribute('otparsc'));
                      var mr_onparsc2 = Number(xmlMR[AwayID].getAttribute('onparsc'));
                      var mr_ofparsc2 = Number(xmlMR[AwayID].getAttribute('ofparsc'));
                      var mr_ofgmrsc2 = Number(xmlMR[AwayID].getAttribute('ofgmrsc'));
                      var mr_otpmrsc2 = Number(xmlMR[AwayID].getAttribute('otpmrsc'));
                      var mr_onpmrsc2 = Number(xmlMR[AwayID].getAttribute('onpmrsc'));
                      var mr_ofpmrsc2 = Number(xmlMR[AwayID].getAttribute('ofpmrsc'));
                      var mr_dftarsc2 = Number(xmlMR[AwayID].getAttribute('dftarsc'));
                      var mr_dfgarsc2 = Number(xmlMR[AwayID].getAttribute('dfgarsc'));
                      var mr_dtparsc2 = Number(xmlMR[AwayID].getAttribute('dtparsc'));
                      var mr_dnparsc2 = Number(xmlMR[AwayID].getAttribute('dnparsc'));
                      var mr_dfparsc2 = Number(xmlMR[AwayID].getAttribute('dfparsc'));
                      var mr_dfgmrsc2 = Number(xmlMR[AwayID].getAttribute('dfgmrsc'));
                      var mr_dtpmrsc2 = Number(xmlMR[AwayID].getAttribute('dtpmrsc'));
                      var mr_dnpmrsc2 = Number(xmlMR[AwayID].getAttribute('dnpmrsc'));
                      var mr_dfpmrsc2 = Number(xmlMR[AwayID].getAttribute('dfpmrsc'));

                      var mr_oftarsd2 = Number(xmlMR[AwayID].getAttribute('oftarsd'));
                      var mr_ofgarsd2 = Number(xmlMR[AwayID].getAttribute('ofgarsd'));
                      var mr_otparsd2 = Number(xmlMR[AwayID].getAttribute('otparsd'));
                      var mr_onparsd2 = Number(xmlMR[AwayID].getAttribute('onparsd'));
                      var mr_ofparsd2 = Number(xmlMR[AwayID].getAttribute('ofparsd'));
                      var mr_ofgmrsd2 = Number(xmlMR[AwayID].getAttribute('ofgmrsd'));
                      var mr_otpmrsd2 = Number(xmlMR[AwayID].getAttribute('otpmrsd'));
                      var mr_onpmrsd2 = Number(xmlMR[AwayID].getAttribute('onpmrsd'));
                      var mr_ofpmrsd2 = Number(xmlMR[AwayID].getAttribute('ofpmrsd'));
                      var mr_dftarsd2 = Number(xmlMR[AwayID].getAttribute('dftarsd'));
                      var mr_dfgarsd2 = Number(xmlMR[AwayID].getAttribute('dfgarsd'));
                      var mr_dtparsd2 = Number(xmlMR[AwayID].getAttribute('dtparsd'));
                      var mr_dnparsd2 = Number(xmlMR[AwayID].getAttribute('dnparsd'));
                      var mr_dfparsd2 = Number(xmlMR[AwayID].getAttribute('dfparsd'));
                      var mr_dfgmrsd2 = Number(xmlMR[AwayID].getAttribute('dfgmrsd'));
                      var mr_dtpmrsd2 = Number(xmlMR[AwayID].getAttribute('dtpmrsd'));
                      var mr_dnpmrsd2 = Number(xmlMR[AwayID].getAttribute('dnpmrsd'));
                      var mr_dfpmrsd2 = Number(xmlMR[AwayID].getAttribute('dfpmrsd'));

                      var upc1;
                      var upc2;
                      var ts=0;
                      var os=0;
                      var temp;

                      // TEAM 1
                      upc1=av_u+(mr_ou1-av_u)+(mr_du2-av_u);
                      if (Site==1) {
                         upc1=upc1+(ha_u/2); }

                      temp=av_tpmrb+(mr_otpmrb1-av_tpmrb)+(mr_dtpmrb2-av_tpmrb);
                      temp=temp+av_tpmrsc+(mr_otpmrsc1-av_tpmrsc)+(mr_dtpmrsc2-av_tpmrsc);
                      temp=temp+av_tpmrsd+(mr_otpmrsd1-av_tpmrsd)+(mr_dtpmrsd2-av_tpmrsd);
                      if (Site==1) {
                         temp=temp+(ha_tpmrb/2); 
                         temp=temp+(ha_tpmrsc/2); 
                         temp=temp+(ha_tpmrsd/2); 
                      }
                      if (temp<0) temp=0;
                      ts=ts+(3*(upc1*temp/100));

                      temp=av_npmrb+(mr_onpmrb1-av_npmrb)+(mr_dnpmrb2-av_npmrb);
                      temp=temp+av_npmrsc+(mr_onpmrsc1-av_npmrsc)+(mr_dnpmrsc2-av_npmrsc);
                      temp=temp+av_npmrsd+(mr_onpmrsd1-av_npmrsd)+(mr_dnpmrsd2-av_npmrsd);
                      temp=temp+av_fpmrb+(mr_ofpmrb1-av_fpmrb)+(mr_dfpmrb2-av_fpmrb);
                      temp=temp+av_fpmrsc+(mr_ofpmrsc1-av_fpmrsc)+(mr_dfpmrsc2-av_fpmrsc);
                      temp=temp+av_fpmrsd+(mr_ofpmrsd1-av_fpmrsd)+(mr_dfpmrsd2-av_fpmrsd);
                      if (Site==1) {
                         temp=temp+(ha_npmrb/2); 
                         temp=temp+(ha_npmrsc/2); 
                         temp=temp+(ha_npmrsd/2); 
                         temp=temp+(ha_fpmrb/2); 
                         temp=temp+(ha_fpmrsc/2); 
                         temp=temp+(ha_fpmrsd/2); 
                      }
                      if (temp<0) temp=0;
                      ts=ts+(2*(upc1*temp/100));

                      temp=av_ftarb+(mr_oftarb1-av_ftarb)+(mr_dftarb2-av_ftarb);
                      temp=temp+av_ftarsc+(mr_oftarsc1-av_ftarsc)+(mr_dftarsc2-av_ftarsc);
                      temp=temp+av_ftarsd+(mr_oftarsd1-av_ftarsd)+(mr_dftarsd2-av_ftarsd);
                      if (Site==1) {
                         temp=temp+(ha_ftarb/2); 
                         temp=temp+(ha_ftarsc/2); 
                         temp=temp+(ha_ftarsd/2); 
                      }
                      if (temp<0) temp=0;
                      ts=ts+((mr_ftpct1/100)*(upc1*temp/100));


                      // TEAM 2
                      upc2=av_u+(mr_ou2-av_u)+(mr_du1-av_u);
                      if (Site==1) {
                         upc2=upc2-(ha_u/2); }

                      temp=av_tpmrb+(mr_otpmrb2-av_tpmrb)+(mr_dtpmrb1-av_tpmrb);
                      temp=temp+av_tpmrsc+(mr_otpmrsc2-av_tpmrsc)+(mr_dtpmrsc1-av_tpmrsc);
                      temp=temp+av_tpmrsd+(mr_otpmrsd2-av_tpmrsd)+(mr_dtpmrsd1-av_tpmrsd);
                      if (Site==1) {
                         temp=temp-(ha_tpmrb/2); 
                         temp=temp-(ha_tpmrsc/2); 
                         temp=temp-(ha_tpmrsd/2); 
                      }
                      if (temp<0) temp=0;
                      os=os+(3*(upc2*temp/100));

                      temp=av_npmrb+(mr_onpmrb2-av_npmrb)+(mr_dnpmrb1-av_npmrb);
                      temp=temp+av_npmrsc+(mr_onpmrsc2-av_npmrsc)+(mr_dnpmrsc1-av_npmrsc);
                      temp=temp+av_npmrsd+(mr_onpmrsd2-av_npmrsd)+(mr_dnpmrsd1-av_npmrsd);
                      temp=temp+av_fpmrb+(mr_ofpmrb2-av_fpmrb)+(mr_dfpmrb1-av_fpmrb);
                      temp=temp+av_fpmrsc+(mr_ofpmrsc2-av_fpmrsc)+(mr_dfpmrsc1-av_fpmrsc);
                      temp=temp+av_fpmrsd+(mr_ofpmrsd2-av_fpmrsd)+(mr_dfpmrsd1-av_fpmrsd);
                      if (Site==1) {
                         temp=temp-(ha_npmrb/2); 
                         temp=temp-(ha_npmrsc/2); 
                         temp=temp-(ha_npmrsd/2); 
                         temp=temp-(ha_fpmrb/2); 
                         temp=temp-(ha_fpmrsc/2); 
                         temp=temp-(ha_fpmrsd/2);
                      }
                      if (temp<0) temp=0;
                      os=os+(2*(upc2*temp/100));

                      temp=av_ftarb+(mr_oftarb2-av_ftarb)+(mr_dftarb1-av_ftarb);
                      temp=temp+av_ftarsc+(mr_oftarsc2-av_ftarsc)+(mr_dftarsc1-av_ftarsc);
                      temp=temp+av_ftarsd+(mr_oftarsd2-av_ftarsd)+(mr_dftarsd1-av_ftarsd);
                      if (Site==1) {
                         temp=temp-(ha_ftarb/2); 
                         temp=temp-(ha_ftarsc/2); 
                         temp=temp-(ha_ftarsd/2); 
                      }
                      if (temp<0) temp=0;
                      os=os+((mr_ftpct2/100)*(upc2*temp/100));

                      var td1;
                      var td2;
                      if ((ListBy=="Winner") || (Site==0)) {
                         if (os>ts) {
                            td1=document.getElementById("tdUpcoming_" + GameID + "_2_sc");
                            td1.innerHTML=parseFloat(Math.round(parseFloat(ts) * 100) / 100).toFixed(2);

                            td2=document.getElementById("tdUpcoming_" + GameID + "_1_sc");
                            td2.innerHTML=parseFloat(Math.round(parseFloat(os) * 100) / 100).toFixed(2);
                         } else {
                            td1=document.getElementById("tdUpcoming_" + GameID + "_1");
                            td2=document.getElementById("tdUpcoming_" + GameID + "_2");
                            var tdTmp=td2.innerHTML;
                            td2.innerHTML=td1.innerHTML;
                            td1.innerHTML=tdTmp;                        

                            td1=document.getElementById("tdUpcoming_" + GameID + "_2_sc");
                            td1.innerHTML=parseFloat(Math.round(parseFloat(os) * 100) / 100).toFixed(2);

                            td2=document.getElementById("tdUpcoming_" + GameID + "_1_sc");
                            td2.innerHTML=parseFloat(Math.round(parseFloat(ts) * 100) / 100).toFixed(2);
                         }
                      }
                      else {
                         td1=document.getElementById("tdUpcoming_" + GameID + "_2_sc");
                         td1.innerHTML=parseFloat(Math.round(parseFloat(ts) * 100) / 100).toFixed(2);

                         td2=document.getElementById("tdUpcoming_" + GameID + "_1_sc");
                         td2.innerHTML=parseFloat(Math.round(parseFloat(os) * 100) / 100).toFixed(2);                     
                      }

                      var ScoreDiff=Math.abs(os-ts);
                      var GameRating=calcGameRating(((ScoreDiff>20) ? 0. : (20.-ScoreDiff)/20.),GamePace,GameShooting,GameAPAvg);

                      var CloseGame=0;
                      if (Math.abs(parseFloat(Math.round(parseFloat(os) * 100) / 100).toFixed(2)-parseFloat(Math.round(parseFloat(ts) * 100) / 100).toFixed(2)) <= 3.) CloseGame=1;
                      td1=document.getElementById("tdUpcoming_" + GameID + "_1");
                      td1.style.borderTopWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderTopColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.borderLeftWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderLeftColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1=document.getElementById("tdUpcoming_" + GameID + "_1_sc");
                      td1.style.borderTopWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderTopColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.borderRightWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderRightColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1=document.getElementById("tdUpcoming_" + GameID + "_2");
                      td1.style.borderLeftWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderLeftColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1=document.getElementById("tdUpcoming_" + GameID + "_2_sc");
                      td1.style.borderRightWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderRightColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1=document.getElementById("tdUpcoming_" + GameID + "_3");
                      td1.style.borderBottomWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderBottomColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.borderLeftWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderLeftColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.backgroundColor = ((CloseGame==0) ? "#606060" : "#00A000");
                      td1=document.getElementById("tdUpcoming_" + GameID + "_3_st");
                      td1.style.borderBottomWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderBottomColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.borderRightWidth = ((CloseGame==0) ? "1px" : "2px");
                      td1.style.borderRightColor = ((CloseGame==0) ? "#CCCCCC" : "#00A000");
                      td1.style.backgroundColor = ((CloseGame==0) ? "#606060" : "#00A000");
                      if (GameRating>=3.5) {
                         td1.innerHTML="<div style=\"display: inline-flex;\"><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-star\"></span></div>";
                      } else if (GameRating>=3.15) {
                         td1.innerHTML="<div style=\"display: inline-flex;\"><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-halfstar\"></span></div>";
                      } else if (GameRating>=2.8) {
                         td1.innerHTML="<div style=\"display: inline-flex;\"><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-star\"></span></div>";
                      } else if (GameRating>=2.45) {
                         td1.innerHTML="<div style=\"display: inline-flex;\"><span class=\"clip-star\"></span><span class=\"clip-star\"></span><span class=\"clip-halfstar\"></span></div>";
                      } else if (GameRating>=2.1) {
                         td1.innerHTML="<div style=\"display: inline-flex;\"><span class=\"clip-star\"></span><span class=\"clip-star\"></span></div>";
