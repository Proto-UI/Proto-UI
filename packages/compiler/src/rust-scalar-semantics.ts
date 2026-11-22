// Shared ordinary Rust language primitives. No host or component authority.
export const rustStringToNumberSource = String.raw`// These are scalar conversion primitives, not an evaluator for authored IR.
// StringToNumber accepts the ECMAScript numeric-string grammar; Rust's FromStr
// additionally accepts inf/infinity and has a different whitespace predicate.
fn ecma_numeric_space(value:char)->bool { matches!(value,
    '\u{0009}'..='\u{000d}'|'\u{0020}'|'\u{00a0}'|'\u{1680}'|
    '\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}') }
fn ecma_radix_number(text:&str,radix:u8,width:u32)->f64 {
    if text.is_empty(){return f64::NAN}
    let(mut bits,mut significand,mut guard,mut sticky)=(0usize,0u64,false,false);
    for byte in text.bytes(){
        let digit=match byte{b'0'..=b'9'=>byte-b'0',b'a'..=b'f'=>byte-b'a'+10,b'A'..=b'F'=>byte-b'A'+10,_=>return f64::NAN};
        if digit>=radix{return f64::NAN}
        for shift in (0..width).rev(){
            let bit=(digit>>shift)&1;
            if bits==0&&bit==0{continue}
            bits=(bits+1).min(1025);
            if bits<=53{significand=(significand<<1)|u64::from(bit)}
            else if bits==54{guard=bit!=0}else{sticky|=bit!=0}
        }
    }
    if bits<=53{return significand as f64}
    if bits>1024{return f64::INFINITY}
    // Binary/octal/hexadecimal are powers of two. Round the exact integer once,
    // including halfway cases, instead of repeatedly rounding an f64 accumulator.
    if guard&&(sticky||significand&1!=0){significand+=1}
    (significand as f64)*2f64.powi((bits-53)as i32)
}
fn ecma_string_number(text:&str)->f64 {
    let text=text.trim_matches(ecma_numeric_space);
    if text.is_empty(){return 0.}
    match text{"Infinity"|"+Infinity"=>return f64::INFINITY,"-Infinity"=>return f64::NEG_INFINITY,_=>{}}
    if let Some(digits)=text.strip_prefix("0x").or_else(||text.strip_prefix("0X")){return ecma_radix_number(digits,16,4)}
    if let Some(digits)=text.strip_prefix("0b").or_else(||text.strip_prefix("0B")){return ecma_radix_number(digits,2,1)}
    if let Some(digits)=text.strip_prefix("0o").or_else(||text.strip_prefix("0O")){return ecma_radix_number(digits,8,3)}
    let bytes=text.as_bytes();let mut index=0;
    if matches!(bytes.first(),Some(b'+'|b'-')){index+=1}
    let mut digits=0;
    while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1;digits+=1}
    if bytes.get(index)==Some(&b'.'){
        index+=1;while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1;digits+=1}
    }
    if digits==0{return f64::NAN}
    if matches!(bytes.get(index),Some(b'e'|b'E')){
        index+=1;if matches!(bytes.get(index),Some(b'+'|b'-')){index+=1}
        let start=index;while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1}
        if index==start{return f64::NAN}
    }
    if index!=bytes.len(){return f64::NAN}
    text.parse().unwrap_or(f64::NAN)
}
`;

export const rustNumberToStringSource = String.raw`fn ecma_number_text(value:f64)->String {
    if value.is_nan(){return "NaN".into()}
    if value==0.{return "0".into()}
    if value==f64::INFINITY{return "Infinity".into()}
    if value==f64::NEG_INFINITY{return "-Infinity".into()}
    // Use the existing JSON dependency's shortest correctly rounded digits.
    // Rust Display rounds decimal halfway cases away from zero (e.g. 2^-25),
    // whereas the source operator reference uses the even final decimal digit.
    // Only the digits are reused; apply Number::toString's own layout below.
    let shortest=serde_json::Number::from_f64(value.abs()).expect("finite native number").to_string();
    let (mantissa,exponent)=shortest.split_once('e').or_else(||shortest.split_once('E'))
        .map(|(digits,exponent)|(digits,exponent.parse::<i32>().expect("native float exponent")))
        .unwrap_or((&shortest,0));
    let decimal=mantissa.find('.').unwrap_or(mantissa.len())as i32+exponent;
    let all=mantissa.replace('.',"");let leading=all.bytes().take_while(|digit|*digit==b'0').count();
    let digits=all[leading..].trim_end_matches('0');let n=decimal-leading as i32;let k=digits.len()as i32;
    let text=if k<=n&&n<=21{format!("{digits}{}","0".repeat((n-k)as usize))}
        else if 0<n&&n<=21{format!("{}.{}",&digits[..n as usize],&digits[n as usize..])}
        else if -6<n&&n<=0{format!("0.{}{digits}","0".repeat((-n)as usize))}
        else{let fraction=if k==1{String::new()}else{format!(".{}",&digits[1..])};format!("{}{fraction}e{:+}",&digits[..1],n-1)};
    if value.is_sign_negative(){format!("-{text}")}else{text}
}
`;
