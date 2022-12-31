---
layout: post
title: Merge Sort(합병 정렬)
subtitle: Merge Sort에 대해 이해해보기
categories: DataStructure
tags: [DataStructure]
---

## Merge Sort(합병 정렬)
### Merge Sort(합병 정렬)란?
분할 정복 알고리즘의 하나로, 
1. 입력값들을 분할해서 작은 문제들로 만들고 (Divide)
2. 각각의 문제들의 해를 얻고 (Conquer)
3. 각각의 해들을 합쳐서 최종 해를 얻는다.(Combine)

### Merge Sort(합병 정렬) 과정
![mergeSort](https://user-images.githubusercontent.com/95980754/198835684-bd78dfca-a688-4b92-aa92-4de3df542ab9.png)

1. 합병정렬은 순환함수를 이용해서 입력값들을 절반으로 분할한다. 
2. 순환함수는 계속 자기자신을 호출하고 결국 각각은 1의 크기를 가질때까지 분할된다.
3. 더 이상 분할 할 수 없으므로 각각 순환함수들에서 합병함수를 호출하면서 정렬과정(각각의 해들을 얻는다)이 시작된다.
4. 결국엔 모든 해들이 합쳐져서 정렬과정이 완료된다.

### Merge Sort(합병 정렬) 알고리즘
```
MergeSort(int l, int h){
    int m;
    if(l >= h) return 0; // 순환함수의 끝
    m = (l + h) / 2; 
    MergeSort(l, m); // 
    MergeSort(m+1, h); // 순환함수로 각각 1/2로 분할
    Merge(l, m, h); // 정렬 및 각 해들의 합병 과정
}
```
### Merge Sort(합병 정렬) 시간 복잡도(Big O)
<br>
합병정렬은 다음과 같은 순환함수로 표현할 수 있다.
<br><br>
MS(n) <br>
= 0 (if n <= 1) <br>
= 2MS(n/2) + n (if n >= 2) <br><br>

왜 저렇게 표현할 수 있는 걸까? 

위 코드에서 보면 MergeSort(l, m)과 MergeSort(m+1, h)이 MS(n/2)와 동일하기 때문이다.

그렇다면 n은 어디서 나타난 것일까?

합병정렬 과정 그림에 있는 Conquer 부분을 잘 살펴보자.

Conquer 과정 즉, Merge(l, m, h)의 정렬과정에서 n번의 연산이 발생한다.

결국...!<br>

MS(n) <br>
= 2MS(n/2)+n/2 + n <br>
= 2*(2MS(n/4) + n/4) + n<br>
= 2^2(MS(n/4)) + n/2 + n<br>
= ...<br>
= 2^k * MS(n/2^k) + k*n (n/2^k = 1)<br>
= n * log n (k = log n)

시간복잡도는 O(n*log(n))이 된다.

![mergeSort](https://user-images.githubusercontent.com/95980754/198835684-bd78dfca-a688-4b92-aa92-4de3df542ab9.png)

직관적으로 이해해보자면 분할과정에서의 시간복잡도는 O(1)이다. 

즉, 실제로는 합병 과정에서 연산의 대부분이 발생한다. 

대신 분할 과정에서 입력값들을 절반으로 나누면서 합병 과정의 높이가 log(n)이 된다. 

그리고 각각의 합병 과정에서는 n만큼의 연산이 발생하므로 결국 n(가로) * log n(높이)이 된다.





