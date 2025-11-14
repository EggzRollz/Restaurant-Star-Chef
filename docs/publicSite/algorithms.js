export function  mergeSort(arr, key){
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid), key);
    const right = mergeSort(arr.slice(mid), key);
    return merge(left, right, key);
}

function merge(left,right,key){
    const result = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length){
        if(key(left[i]) < key(right[j])){
            result.push(left[i++])
        }
        else{
            result.push(right[j++])
        }
    }
    return result.concat(left.slice(i)).concat(right.slice(j));
}

export function filterBy(tag, list) {
  const lowerTag = tag.toLowerCase();
  return list.filter(item => 
    item.tags.some(t => t.toLowerCase() === lowerTag)
  );
}