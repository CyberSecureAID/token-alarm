// ============================================================
//  tokens.js — Token definitions, state & logo resolution
//  v5.1 — + totalSupply/decimals en priceState, formatSupply()
//         (resto idéntico a v5.0)
// ============================================================

const TRUST_WALLET_BASE =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';

const USDT_LOGO_URL = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png';

const LOGO_0877_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABAMDBAMDBAQDBAUEBAUGCgcGBgYGDQkKCAoPDRAQDw0PDhETGBQREhcSDg8VHBUXGRkbGxsQFB0fHRofGBobGv/bAEMBBAUFBgUGDAcHDBoRDxEaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGv/CABEIBAAEAAMBIgACEQEDEQH/xAAcAAEBAAIDAQEAAAAAAAAAAAAAAQIGBAUHAwj/xAAbAQEAAwEBAQEAAAAAAAAAAAAAAQQFAwIGB//aAAwDAQACEAMQAAAB99AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAADWNk8gUu2mvmVsDXqbC14bC14jYmuk7Dj0ENguvEbE14nYWvEbC1+GwteGwzX4bC14bE14bDNfGwzXhsTXabDNfhsWOvw2Fr1Nia7U7FNeI2Frw79r8Tsc14bC18bDj0ENguvjYJr9O/a+RsU18nYJ0A2C69TYJ0A2Ca+Nga8PU+78r9UbALQAAAAAAAAAAAAAAAAAAAAAAAAhqnn3N4T562VXFMVQjKSixACUSgBYAIQBUxbDGkoCiCUQsoqAhQJYJQEqAoTKEUkERZEhMVKmwEyhjMsC+qeV7At+nBvAAAAAAAAAAAAAAAAAAAAAAAANZ2byVT6vLHNhS2IWEgERFhIpMCJQAIRUqQEsLZRARQIFkgBSSgAEpZCiRSJQssALLim42IqwBKwZIGOUIsT6v23mfprfgWQAAAAAAAAAAAAAAAAAAAAAAAOg8w7rpmAsKmTGiwkAEAlYQAIAAAKhZYLKJRLBRAJAAFgmUBE2EKJVERbEzZYBEBMyglgBMsbCoLElYD1vyTZVz0gN0AAAAAAAAAAAAAAAAAAAAAB03c+YquvWVgVRLIZJSUCwGJbiRkgsQqCyQysoBQEAhUFKkRFQCGUQyQZQTAAEQzYpZ4iATSAhUoSiykWEURljCWD2Dmed+iT9CCwAAAAAAAAAAAAAAAAAAAAB1nk2x64wpMilFggXKUSxMQhjtf1WdOu3009uA1CbiNNbgNQbhU6e2+mntwiNQbeNQbjDUJuA09uFNPbeNPbfTT24DUG3jUJuA0+7elqM3CxOnNwhqE3BLT5uKGntvGotuqNQbfDUpt5OntvGoXbvgjWoquSllhAVMjHHPGF9j8a3Je30TtgAAAAAAAAAAAAAAAAAAAOBz/OVfWGJ87khGWKFsqaxplIEQ9k5fF5T6cHuwAAAAAAAAAAAAAAAAAAAAAAAAHWdn1bn5KHzTKUASiWRFxyJx+vzh7PyNF3p9GDsAAAAAAAAAAAAAAAAAABxfHNw0xiKihUIpCpU2wWBIh7PyuLyn1APQAAAAAAAAAAAAAAAAAAAAAAAADrOz6xz8kEfN5QnyCbICwtxpcbD7+w+L700N0DZAAAAAAAAAAAAAAAAAAfD76Q46Z8R85VjzFEAoAlYJLD2flcXlPqAegAAAAAAAAAAAAAAAAAAAAAAAAHWdn1jn5JB81bCLECE2gsFlg5XFJ9q+mm7k+jB1AAAAAAAAAAAAAAAAA+fju76AxsbYzlhBCaRFIVMiBMxyxPaOVxOW+oB6AAAAAAAAAAAAAAAAAAAAAAAAAdZ2fVxz8llT80IJRALCMgVEEsmeb7B4h6NGjtYnYAAAAAAAAAAAAAAAAY5as56Pwca+aqHkgSikLZQABLin2flcXlPqAegAAAAAAAAAAAAAAAAAAAAAAAAHWdn1bn5IiPmrYkKSWEohQWUkuI7Dr49+43V9ofRg6AAAAAAAAAAAAAAAPId88wZKjKlRErIkpKWCyi4wyuNGOUT7PyuLyn04PYAAAAAAAAAAAAAAAAAAAAAAAADrOz6tz8khHzNlCiZLCWyYpAgsAuKe29c8N9QaexBrAAAAAAAAAAAAAADpHjQ+mmT5uWx4Y2IWCgRQQSiZQZY2Hs/K1D7vodoauetoauTtDVxtDVxtDV6jZ2sDZ2sDZ2rk7Q1cbQ6rtXUHoAAAAAdO89w1c5bQ1cbQ1cbQ1eo2drETtDV4jaWr02dq5O0NYGz9X1vCc9CZYsCgssESGWLKUAlACZQw73o49+5uj7x9ID2AAAAAAAAAAAAA8v3vyNl5JkyZKRJYCFQUJstRJliUEUQQyRM2ASoqE1EMmNKiVxuIQbvveh743wWwAAAAHn3oPnanqiGDbIZYgBbiTZCKiGTGluItxJsQImMkFiigxyhLBYGSUwmUO/9U8K9fa3ahqAAAAAAAAAAAADr3nRtXHzdDkQCkWIxolYLZE5QQqFsFlEmUCwlC2EAlLCoEsJLE7tvuh743wWwAAAAL534H52p6ncawLFTAiZQWCYUAKMbYJaSZQxqwksSsT5tlEQQKmSbLEJYnHZ9Zye/cXX9g+lB6AAAAAAAAAAAee7v48zvjbGLQQFQDGFVJKTColBZQqEErKBSSxErKYxmUiYfRPzc7kvfUO8zetex2Tojct80PfW3AtgAAAAPPPQ/O1LUbyO+Y2s3YPgnpXacd44c+vzeVVGKwtxyhbEygJcYMsLKgkyhCQyY2YSgtIEgJkRio2r0fw/2SNnmCdIAAAAAAAAAAfBGk6Zn83zmWKuEoSUFGMyEylIQKCDJBkgM+6e+jbv3C15fyfXPo7+Y9htHUmPO1/rEegZ+W/GfPqnF81R53/h6Yc9q42unjuep+Zz3be9F3puAtgAAAAPO/RPO1PVu46Mxdl5WoHTfOV51Y6eo8nyZPT1ri+X8xO79f0/ZvXG67b+2T5R8/buAjyCeldIr6hO16tXlp4iiEgBVTAAJAikUBYYblp30jt7a4/In6QEgAAAAAAAANJ3Hx1Q4qoxJbjMWXEsBljSgILjniFGKdunquX6FsTS0LY+86Nc7mebdA4+la9qMU+z6yVUpXmTKQWJWyoiwlkEQ3retD3x9CC2AAAAA879F85UtSuOTCWZIQhZcSwklCxD69v0aem9bB5KW/ceP5FtC522vb5zHTxP5e16mo+f483hqEyxyiMkIRJZAtlSgjJBCJkuJvG+eIe0xtfYToAAAAAAAADFGo+f83hPnskK7HIjFYJRLBUoCLGJfr8fUVjjbWN98vrpCOn1pk+eUc0yiFsCwuNJAWEWQJYmSxG8b5oW+voQWwAAAAHnXovnKnqGUyYFqBBlCEqiURUksgAiSy3vQjv7m6Dv30Pz0L0E5+F3d9JYKDlSiyoSyJVjLJCMpCWOeMRhv+hcx39nYZz9GCQAAAAAAGq7T5Ap9euLBoKERYYrACVUFxEyhyfafDvaWvyA1XTdyePDsfYdDYuukUVEWCSAUhAECkmWJJYneN90PfG+C4AAAAA889D87U9RsMClJMoFiQCEZSDJETYxmKZo+f12DfV52I3Aevl4l7F42yLLGZbCKCkTYsIBYLAlD0TbvG/Y53aF0AAAAAADjeSeycRU8Ydl1rCoeVQoRiuJUsQtTMAmWKMdk1w6e4Z+PeiNzvSriWHF1ncDj5b0vtmKn4e9d6ea3nU3DrIr9FeVxHCykIIoEYlKbxvflewtrc2mRY3RpkN0aYNzaWN0aWN0aXDdfPOfrSt0tlY7KUoMccoFiWN5Bxnddq66k9E7dZ8p7v1DJa1DZeUXAdgHy6fz5T5XQ1GJMac5kkqRNRELKJlExRFkxZO6e+P63OQ3gWgAAAAAAAON5X678VXxK950bCoc6CY5YlSmVxFBccsUQEykT3u3eaFr2/wCnh+wr/p7Uu/XOcHYBYHx+xHUcHZTlpfD9AOXmfF9WOfjvw9pOfiXy9yjz4bfbfkjxd7H83nyDL1rFHk+Pq8R5S9Wp5O9ayT5JPYPonxvH2r7PXiP19tqfGOR6+evLOT6UdPP+Zuh01nndwdfh9x1BIAFnD6Jy2n5+ba+pei6f0iKNqqrHLFC45CWElgoLKUiRZhGyvfG9Ryzb4LIAAAAAAAAAHz8z9Qiv4hNo1hgkOTHIYrC2UWUQIpEmUIoSky2HP7rVTt6H3Hkha9wz8M7F39ieX9g7egNQ5ztsLrua6/QPQJAAsAAAAAAAAARFfDhPPaNf4TltrQeucfT/AJeR8Fx9V6rzwr7X0vXxXmRHIEJliLKMbEKJQLMpKKhjbJLIVjurp8PRqb4O4AAAAAAAAAAAE889EOHhl3XSmDQ4wEIXLGopU424opRKTKEmUJKMchMqohIUSixP25PAR67nka9Z97P99RPe6/THeWlpee4x21HLaoau2gavNoGrY7ZTUflueSNGx3vRHH48bW6zu74/Vx45nG+dc5krzUCiZMsSLCmRJRFDGglhLMjFRFCWSEhljcC4vRZ68feRvg7AAAAAAAAAAAAAANK3U5eGvRPO2BYOEZQmUpZRCoBIGOUFimNAUhBjlCkhlAVJKhQbxvOjby+gBbAAAAAuhb5oSnpiGBZRjVLFMVhSJqUmGWJcpzfccSc/K3463PsMO7jZfXL3Pw+fKwhxZz8vHnrp2GNaeBeR8KvuTK+fWFWYwuXprv8ADaxvg6AAAAAAAAAAAAAAAANX2g5+HT1LzJg/MRWJZEkLYlQIhbiMiBKVAlgsomUAEykQhK3DNO8bzou9PoAWwAAAAGhb7oSnpdlYBYICCQMohHI5Frz8fu2rQ96r9vS+Z4vaL2/J6Xz02bnaHeXXf2h3x73toUN263WsevLsun7XvenPzbL1rX/XHQuJ33WxR6378r0jNt/LvTlvA9gAAAACFAAAAAAAAAAAA6Tuzx4l8PX/ACphcdKqKACZYwgkKFgELKlASyiWIpRKgxyxkuOSd43rRN7fQAtgAAAAND3zQlPSspWAxyxJZDKQVjzPTDlXt9b10m27b1/jT7TrNQ77l16nPevp59693X3VbIc+oAAI4PSbS7cdB5O68TvXnD1178dX8vS+j78Ow7TxzcufbcRmaYAAAAAAAAAAAhQCFAAAAA63sjz4txPZvKWHwmOSlFCZDCgBQRKFpjjlCZTJDGhcRlYEsTCG9b1om9voAWwAAAAGhb7oSppaxgJcSAxl7Dr5ZPSdnvwNl4Ol0Nbk8vY+w8+sMylcBIAAAAB8Hrn92Gfn24nLTGidtsuvXaXb+cdjvfvn5/6FoHC78fT3z+mPsAkAAAAAAAAAAAAAAAAABxeUR5F1XtflrF6dKz1xsEslUGURAyIQkyxhSTNspFpGWISmIN53vRN7fQAtgQFAAA0PfNCU9LljBxKYr9/b7fTH0vb7fb5NXoa3G9GzvDsFewAAAAIita1K9nbzqnQ/TW+e+mfyzuYe47R0Hf8AzH3wVtEDrtH9J4tqplpfB9D7cvOPTPN/tZr+iDG2AAAAAAAAAAECgEKAlAAAAHy+pHlvQe3+ZsfW6M0UxlkLLJhlAlElgIWzKJWDKJIlIDeN70Te30ALYAAAADQd+0FU03BGAuOJ9+Tn2+167/vud5pU2s/Sfl9uHYK9gAAAcaY5Pz0TS9Oj6Fp/T/XYxvv9OP8ASzn8jP4fSK/2z+OXmt6d2Xx+3yH6GHjsABwtB9L6i3U7HyHatmscOm23w72WJ5gzdEAAAgoAAAAAAAIsAKQoAAAEpHnmoe5efsrTWOTKqoMc8ZRIjJBUBlCUTDKEWSlBKN33vRd6fQAtgAAAAPP/AEDz5U0uSMG8jjdhajH13Ttuua2td/q2/wBfuFG6AAA6/sPLLXL66Vw8/q8j7/Tj/TvU5P04318ceRnx8/PHkfbi/WK/35PC7Xj49VHx/wB6CQAANK73t/MdCj2PB9G8Wt1fb3WdnjawefQACWFIUAACWCoUAAAEsoAAAAABpege56kzPOrijHyRJjnDEiKmRbCUsGWORZZE40mCjeN50beX0ILQAAAAg8/3/wA/VNJVOF9/rjs23737Stz02lsbryCjcCJAAAeJ+2fnrZr8HPjfT6fN5H04/wBPPDkfTj/Tzw5H04/088vv9Phn5r8jY9Y3On038fJ/YgAAANd2J78atwOr9E0KPnHp/gXuvuOQMnSARQAAAAlAAAAAAAAAAAAAANb8x9y6Fn+U36/Fi5JkjGZQmQDEpSZSFKmLIiWJb1vOi70+gBbAAAELEHn3oHnyppNx5PvDy9V8q9v19DRtn0X02paChdAAAAn5n/Rf5q+h4/bObnt1dQ5nsXW5nny36cfPVz+T9ON9fPL7/T4ZRX5Ho3mfreVb2IfM/SAAEFABpffc3Rr9Lq9j+2p3qvrIwtcABKAAJUKAlBBUKAAAAgsUAAJRFAAOn8s9r61R8dvL4bEyK842wSiWCwKlLLITHPGW8b5om9voAWwJQSwqBLCee+g+fKmj8ri8q/hd76bpfb9tfofRNX2ipYCrZASglAOm030tZjhc0rnmXpvjejy036fD6fXZX3+nwz88eRl8rFX7+3eG/oHB0foMDaASiUCUAeZem+b36m/eJe5+H263ud63ssfSDz6hQQsUASgABKIoAAAAigAgoAIBQAA4PlPsnFVPFMuz6phZ2V4Y5RONpAqMckTVhisTvG96JvbfBbASwALCSwnn3oHnqrpPK4fK2ML0zru+1Dzrbz2Xz+mXfDz6AiwoAAAHg3vP5u2+XFz+Wf01L7Z/HPzW+9+WUVOy998S9t+a1QxtEABKAAGm7lrlnhy/Nt61HRp7btGj7xnXArdwEsKACUEoihLBQRSKBCkKACAqCggFQqUAA4/lnrfzVvEGx64wbFeJlBcaRKomUMZSd33zQ98b4LQJIKgssRJYY+fegeeK2kcjjcrbw/YdI3nROGv6dTLvAkAlAACUA+X5l/Q354+j85ZYX6Cv9cvln5qfXL5ZRU3b1/zH075DWDOtAIFSgADo+86Trz6rou86TVo8v0Hz70GlZClZAShAoABCkLFAJQAAIKQsCpQgoABBYFAADHzX0yOHhrcNOYORXKWkSZCTITHIfXmdae+ynXHrssuqp2k63E7O9WT2mPWw7F1eJ2fX8fB6x5fC5m159g0ra9d56voeXE5eVeCPQCUQFAABp/h/rHkv1vTJGvyzy+dip9cvjl4p+y7vreyfEagVughQAAAOg7/Ve/L569t2k6VPut90vdKNkKlgACLCgILLCgASglJYLAUEolQoJQILAssAFAlAAGhb6cfDnoGgsGWHEkMoimeJjUKlQUmAkBLCYZRPy+X0k+/jyuP9dH16N9+g3j3qfDvtF3qnZCt3AEKQqUAA8k843LTftrZF7xbiVM2P28VP0Z2Ev5/dCJlAQFCUAaHvnmN6rv3lHs3gdzh6zsnC5uVdDl0AIKlAAAAAAICxRKCCgJQAlAEsBRKIogKAABqm1nPw/D1DzNg4JVdYMkoxyGNEEJhEWiZjliY454p+eGfzn188/nO3vtvb/wA9+76mj5x6r5d6bV7/AEGdcSglCUAAS4n566Tk8b7/AF4TtxRFXLuuj3GrV91HwnsAAABFAJ5lunR6FTYvHN96a7X9TGFpgAQBYUAAAAEoIFgVKAASgIWUEAFAAlgBUoAAA6LvK8eIfP1zyxh8cKiwZFJMoYAhkiUGNicZlinD5/X5z7+Hz+3xn39/RfOe03+/pvB2/wAtztD1IZ9wCKJZQAB1/P1rr78BuN/QPoBJrwRUejec+u5lX0kfG8QAAJQAHHR59v3m++6dPy7fvK/erPLMYekASkUACFBLBZYWBQSwLKJQgVKACFlhYAFASggsAFgFgABet7I8+L8P2XylicBYpZWUJkYzLEWUqwkyhjLinH5fX5z6+Py+3zn38eT8Nm0um94+ce4TpaxtHk3qtfr9BSsgACFA0PfPLb1vyyy/dfRWWRXksilPdPCv0XhUu9Hy1RLCgAAAef7houhV3PRd+8Vt8N29H4fMzLaWV+1AAlAhQSgikoEpLKCCoLBZYVKSgAiiUSgAIVBUCoFCBYFSgheJyyPIOp9u8sYvTBQuUFiJlsRUoxsMJninDHLCZ+M5Pqa1wNj++Db8g3TuPJvoM72TTt01zPs7u1HbqVgOfsAAlHjPs3guvq6pT7L6WyxXmOU8Z+H6g/Nv6b+Zyw+foiFAAAl887c+q9P6PhXa+p99p3t1rjmMLSAJSVCyiLAoiwAoCURSLCywssKlJQJRLAsKCUAEBZRAssKlIsBSApAofP6EeX677h5tORrAjOyxpEWAhYExzwPnzOT6vN7h9pnjG1hh9cZ9fHUdx+fXn5D7N5lwdmh2+2d35pS7+ntc2OhaI8egAH5z/RP5l+g+i+RPqfprJIqWJ5od9+ifD/cPkcAlx6BBQAI0zr4fL4bhdr/Lxm+k6FbuO5Pn9IPPoBAqCyhKBCpSAWUiwpAUiwssFgqBZSLCwLAsAAAACwAFgWUgALAUEo0DTfcdInK0UsZbG4oq0xmUMO/5npDR+P2psYzKJxxzh88PrjLj+Y+p/K1x8t9d8p4GpS2Ttdm1+jZ2t5Z6RX68tFbrZBx/JPYpbueN4+yrHbxnL2Wxz8ay9jvqdK3jFQqZQ5cwFgs67z+1x7Hl9x9e/LleMfHfdGt8/QlxNBK4dAAEolQpBYFCAAoIAAsAAAAAFlBAAAAAAAAAAUgLAVCpRLCpTUvPfb9YZvmjLFkUyRjvXN2lrljTAijGZQxx+mJ88PrjL4aNv2Pfn4l6p8vN9mh7H5/8fSKXfVNz6jS/Hv02ee7bX6dpCt1WJZJYW45FSgiLde1O3x9E0P5b128aN6HwPNOnja/OOw9Yueel24w9As5e6QqCkKCFEogKCUIolCAAsCyiUIABYKQAAAqAAAAsAAAAKlIsKgqUSiWDX/NfauoUPLvS+T2hYL4FgAJRMchjjnD5z6SXx+XJxPO9O9z4mtT0fetG06xx9v1PVdt4dOp+m79hw6aZ2PY9X5nn/XXvhLaPhr/Jhzeo7ntDz6+m9N089Rtmh6l25+r6Drm89vPn/oe6cir1mUuVcAsUlQWUJRLCwALLCyiLAsFQAALCywqACywAAAAAAAAAAAWAAAACwABSAAsAsLLAAABKJMoYsoY45j54/WS+OH3hqmteoS7X8Ovt/BvcPN+w2Xrpjj/T4fKXM42H2Ov6vceyh5HyvauXE+V7fs1od8cqp2CoAAAWAAABZRAWAAsAAAAFgAAAAAAAAAAAAAAAAAAAWWAAAAACykWAAAAAAEUSZQxZQxZDBkMZmMGaWLJDG5CLSKCgAABZSAAAWACwACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASiKIBLSKIoiiUAAAAAAAAAAABRAsUgAAAAAAAAAAAAAAAAAAKlIAACwAAAAAAAAACwAAAAAAssAAABSFIAACxSAAAAAAAWAAACywsAAAAAAAAAAUiwAAAAAAAAApAAACwCiAAWUgAAAAAAALFIUSwLCwLAAAFIUgCiAAAAssLAFIAAABYAAAAAAAAAAAALAAAAAAAAAAAAsAsAAAFQsAAAACwAFgAAKAEillBAAUgLAoEsFQLAAUgAFgqACywAAAAFIACywAALBYCwAAAAFICpZQQAAAAAssAFgALAAUgLFJYCwAsUgALAssLAqCkLFCCxRKIUAIKgqUILAAsACyiAAsAogAAAAAAAAKlIAAsAAAAAAAAAAAAAKgqCwAALAqCoCwVAACoAAFgsACwAAAAKgApAAAACwAKQpCxRAAsAACwAAAAAAAFgqAABYAALAAAAAAAAAWCwAAAAAAAKgAAWACwAAAALAAsCoAAAAAALAAAAAAAAAsCwALAsAD';

function twLogo(addr) {
  return TRUST_WALLET_BASE + addr + '/logo.png';
}

function generateAvatarSVG(symbol, color) {
  const letter = (symbol || '?')[0].toUpperCase();
  const c = color || '#c9a84c';
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="24" fill="${c}18"/>` +
    `<circle cx="24" cy="24" r="23" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.4"/>` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="Georgia,serif" font-size="20" font-weight="400" fill="${c}">${letter}</text>` +
    `</svg>`
  )}`;
}

function last4(address) {
  return address ? address.slice(-4) : '????';
}

// ============================================================
//  TOKENS — cargados desde localStorage + defaults
// ============================================================
const DEFAULT_TOKENS = [
  {
    address:      '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
  {
    address:      '0xf15c7f1F86398520b70505e9cC285A8b18D9A21f',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
  {
    address:      '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
];

const CUSTOM_TOKENS_KEY = 'token_alarm_custom_tokens';

function loadCustomTokens() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || '[]'); }
  catch { return []; }
}

function saveCustomTokens(tokens) {
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

function addCustomToken({ address, symbol, name, color }) {
  // Normalizar dirección
  address = address.trim();
  if (!address.startsWith('0x')) address = '0x' + address;

  // No duplicar
  if (TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())) {
    return { error: 'Este contrato ya está en la lista.' };
  }

  const token = {
    address,
    symbol:       (symbol || address.slice(-6)).toUpperCase(),
    name:         name   || 'Token ' + address.slice(-6),
    chain:        'bsc',
    color:        color  || '#c9a84c',
    pairAddress:  null,
    isBaseToken:  false,
    verified:     false,
    logoOverride: null,
    custom:       true,
  };

  const customs = loadCustomTokens();
  customs.push(token);
  saveCustomTokens(customs);

  TOKENS.push(token);
  initTokenState(token);
  return { ok: true, token };
}

function removeCustomToken(address) {
  const idx = TOKENS.findIndex(t => t.address.toLowerCase() === address.toLowerCase() && t.custom);
  if (idx === -1) return false;
  TOKENS.splice(idx, 1);
  delete priceState[address];
  const customs = loadCustomTokens().filter(t => t.address.toLowerCase() !== address.toLowerCase());
  saveCustomTokens(customs);
  return true;
}

// TOKENS es el array vivo — se llena al inicio
const TOKENS = [...DEFAULT_TOKENS];

(function loadSavedCustoms() {
  loadCustomTokens().forEach(t => {
    if (!TOKENS.find(x => x.address.toLowerCase() === t.address.toLowerCase())) {
      TOKENS.push(t);
    }
  });
})();

// ============================================================
//  PRICE STATE
// ============================================================
const priceState = {};

function initTokenState(token) {
  priceState[token.address] = {
    price:           null,
    priceNative:     null,
    prevPrice:       null,
    prevPriceNative: null,
    priceChange1h:   null,
    priceChange:     null,
    priceChange7d:   null,
    volume24h:       null,
    liquidity:       null,
    marketCap:       null,
    fdv:             null,
    holders:         null,   // sin fuente gratuita confiable sin API key — ver prices.js
    totalSupply:     null,   // unidades de token (ya dividido por decimals)
    decimals:        null,
    txns24h:         null,
    buys24h:         null,
    sells24h:        null,
    buyVolume24h:    null,
    sellVolume24h:   null,
    pairCreatedAt:   null,
    symbol:          token.symbol,
    name:            token.name,
    pairAddress:     token.pairAddress,
    logoUrl:         token.logoOverride || USDT_LOGO_URL,
    verified:        !!token.verified,
    logoResolved:    !!token.logoOverride,
    source:          null,
    lastUpdated:     null,
    error:           false,
    loading:         true,
    errorMsg:        null,
    bnbPriceUsd:     null,
  };
}

TOKENS.forEach(initTokenState);

// ============================================================
//  LOGO RESOLUTION
// ============================================================
function testImage(url, timeoutMs = 4000) {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    img.onload  = () => finish(true);
    img.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    img.src = url;
  });
}

async function resolveTokenLogo(token) {
  const state = priceState[token.address];
  if (!state) return;

  if (token.logoOverride) {
    state.logoUrl      = token.logoOverride;
    state.logoResolved = true;
    _patchCardLogo(token.address, token.logoOverride, true);
    return;
  }

  const candidates = [
    twLogo(token.address),
    twLogo(token.address.toLowerCase()),
    USDT_LOGO_URL,
  ];
  for (const url of candidates) {
    const ok = await testImage(url, 3000);
    if (ok) {
      state.logoUrl = url;
      _patchCardLogo(token.address, url, token.verified || false);
      return;
    }
  }
  const avatar = generateAvatarSVG(token.symbol, token.color);
  state.logoUrl = avatar;
  _patchCardLogo(token.address, avatar, false);
}

async function resolveAllLogos() {
  for (const token of TOKENS) {
    resolveTokenLogo(token);
    await new Promise(r => setTimeout(r, 150));
  }
}

function _patchCardLogo(address, logoUrl, verified) {
  const img = document.querySelector(`#card-${address} .token-logo`);
  if (img) img.src = logoUrl;
  if (verified) {
    const badge = document.querySelector(`#card-${address} .verified-badge`);
    if (badge) badge.classList.remove('hidden');
  }
}

// ============================================================
//  HELPERS
// ============================================================
function getToken(address) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

function shortAddress(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function contractTag(addr) {
  if (!addr) return '????';
  return addr.slice(-4);
}

function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price) || price < 0) return '—';
  if (price === 0) return '$0.00';
  if (price >= 1000)   return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1)      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (price >= 0.01)   return '$' + price.toFixed(6);
  if (price >= 0.0001) return '$' + price.toFixed(8);
  if (price >= 1e-10)  return '$' + price.toFixed(10);
  return '$' + price.toExponential(4);
}

function formatPriceBNB(price) {
  if (price === null || price === undefined || isNaN(price) || price < 0) return '—';
  if (price === 0) return '0 BNB';
  if (price >= 1)      return price.toFixed(4) + ' BNB';
  if (price >= 0.0001) return price.toFixed(8) + ' BNB';
  if (price >= 1e-10)  return price.toFixed(10) + ' BNB';
  return price.toExponential(4) + ' BNB';
}

function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2)  + 'K';
  return '$' + n.toFixed(2);
}

function formatCount(n) {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

// Igual que formatCount pero SIN signo $ — para supply de tokens (no es USD)
function formatSupply(n) {
  if (n === null || n === undefined || isNaN(n) || n <= 0) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPercent(n, withSign = true) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = withSign && n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function formatAge(isoDateOrMs) {
  if (!isoDateOrMs) return '—';
  const ms   = typeof isoDateOrMs === 'number' ? isoDateOrMs : new Date(isoDateOrMs).getTime();
  if (isNaN(ms)) return '—';
  const diff = Date.now() - ms;
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (mins  < 60)  return mins  + 'm';
  if (hours < 24)  return hours + 'h';
  if (days  < 30)  return days  + 'd';
  if (days  < 365) return Math.floor(days / 30)  + 'mo';
  return Math.floor(days / 365) + 'y ' + (Math.floor(days % 365 / 30)) + 'mo';
}
