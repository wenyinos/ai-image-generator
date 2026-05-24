<span id="0OyQN9w2"></span>
# 接口简介

即梦视频3.0Pro —— 即梦同源的文生视频与图生视频能力，在视频生成效果上实现飞跃，各维度均表现优异。该版本具备**多镜头叙事能力**，能更**精准遵循指令**，**动态表现流畅自然**，支持生成**1080P高清**且具专业级质感的视频，还可实现更丰富多元的风格化表达。

即梦视频3.0Pro支持功能含：


* **文生视频：** 输入文本提示词，生成视频；

* **图生视频\-首帧：** 输入首帧图片和对应的文本提示词，生成视频。


&nbsp;

<span id="obyhNcNN"></span>
# 接入说明

<span id="x8DsbTjJ"></span>
## 请求说明


|名称 |内容 |
|---|---|
|接口地址 |[https://visual.volcengineapi.com](https://visual.volcengineapi.com/) |
|请求方式 |POST |
|Content\-Type |application/json |


<span id="3KggAzew"></span>
## 提交任务

<span id="f5d8azoz"></span>
### **提交任务请求参数**

<span id="1pehRvGl"></span>
#### **Query参数**

<div data-tips="true" data-tips-type="default">拼接到url后的参数，示例：<a href="https://visual.volcengineapi.com?Action=CVSync2AsyncSubmitTask&Version=2022-08-31">https://visual.volcengineapi.com?Action=CVSync2AsyncSubmitTask&Version=2022\-08\-31</a></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|Action |string |必选 |接口名，取值：**CVSync2AsyncSubmitTask** |
|Version |string |必选 |版本号，取值：2022\-08\-31 |


<span id="GZfCefM6"></span>
#### **Header参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">本服务固定值：<strong>Region为cn\-north\-1，Service为cv</strong></div>


主要用于鉴权，详见 [公共参数](https://www.volcengine.com/docs/6369/67268) \- 签名参数 \- 在Header中的场景部分

<span id="3ExOfPfN"></span>
#### **Body参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">业务请求参数，放到request.body中，MIME\-Type为<strong>application/json</strong></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|req_key |string |必选 |服务标识<br><br>取固定值: **jimeng_ti2v_v30_pro** |
|prompt |string |可选<br><br><br>* 文生视频场景必选 |用于生成视频的提示词 ，中英文均可输入。建议在400字以内，不超过800字，prompt过长有概率出现效果异常或不生效 |
|binary_data_base64 |array of string |可选<br><br><br>* 图生视频场景图片和prompt二选一必选<br><br>* 传图时binary_data_base64和image_urls参数二选一 |图片文件base64编码，仅支持输入1张图片（图生视频仅支持传入首帧），仅支持JPEG、PNG格式；<br><br>注意：<br><br><br>* 图片文件大小：最大 4.7MB<br><br>* 图片分辨率：最大 4096 \* 4096，最短边不低于320；<br><br>* 图片长边与短边比例在3以内； |
|image_urls |||图片文件URL，仅支持输入1张图片（图生视频仅支持传入首帧）<br><br>注意：<br><br><br>* 图片长边与短边比例在3以内； |
|seed |int |可选 |随机种子，作为确定扩散初始状态的基础，默认\-1（随机）。若随机种子为相同正整数且其他参数均一致，则生成视频极大概率效果一致<br><br>默认值：\-1 |
|frames |int |可选 |生成的总帧数（帧数 = 24 \* n + 1，其中n为秒数，支持5s、10s）<br><br>可选取值：[121, 241]<br><br>默认值：121 |
|aspect_ratio |string |可选 |生成视频的长宽比，只在文生视频场景下生效，图生视频场景会根据输入图的长宽比从可选取值中选择最接近的比例生成；<br><br>可选取值：["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]<br><br>默认值："16:9"<br><br>&nbsp;<br><br>生成视频长宽与比例的对应关系如下：<br><br><br>* 2176 \* 928（21:9）<br><br>* 1920 \* 1088（16:9）<br><br>* 1664 \* 1248（4:3）<br><br>* 1440 \* 1440 （1:1）<br><br>* 1248 \* 1664（3:4）<br><br>* 1088 \* 1920（9:16） |


<span id="eozh1inS"></span>
### 图片裁剪规则


<span id="4jhFRRNN"></span>
### 

图生视频场景，当传入的图片与可选的取值["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]的宽高比不一致时，系统会对图片进行裁剪，裁剪时会居中裁剪，详细规则如下：

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">说明</div>


<div data-tips="true" data-tips-type="default">如果希望呈现较好的视频效果，建议上传图片宽高比与可选的宽高比取值["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]尽可能接近。</div>



1. 输入参数：

   * 输入图片宽度记为<span data-label="purple">W</span>，高度记为<span data-label="purple">H</span>。

   * 假设输入图片最接近的目标比例记为<span data-label="purple">A:B</span>（例如：16:9），则裁剪后的宽度与高度之比应为<span data-label="purple">A:B</span>。

2. 比较宽高比：

   * 计算输入图片的宽高比<span data-label="purple">Ratio_原始=W/H</span>。

   * 计算目标比例的比值<span data-label="purple">Ratio_目标=A/B</span>。

   * 根据比较结果，决策裁剪基准：

      * 如果<span data-label="purple">Ratio_原始 < Ratio_目标</span>(即传入图片“太高”或“竖高”)，则以宽度为基准裁剪。

      * 如果<span data-label="purple">Ratio_原始 \> Ratio_目标</span>(即传入图片“太宽”或“横宽”)，则以高度为基准裁剪。

      * 如果相等，则无需裁剪，直接使用全图。

3. 裁剪尺寸计算：

   * 以宽度为基准（适用于传入图片“太高”或“竖高”场景）：

      * 裁剪宽度<span data-label="purple">Crop_W=W</span>（使用输入图片原始宽度）。

      * 裁剪高度<span data-label="purple">Crop_H=W\*(B/A)</span>（根据目标比例等比例计算高度）。

      * 裁剪区域的起始坐标（居中定位）：

         * X坐标（水平）：总是0（因为宽度全用，从左侧开始）。

         * Y坐标（垂直）：<span data-label="purple">(H\-Crop_H)/2</span>（确保垂直居中，从顶部开始）。

   * 以高度为基准（适用于传入图片“太宽”或“横宽”）：

      * 裁剪高度<span data-label="purple">Crop_H=H</span>（使用整个原始高度）。

      * 裁剪宽度<span data-label="purple">Crop_W=H\*(A/B)</span>（根据目标比例等比例计算宽度）。

      * 裁剪区域的起始坐标（居中定位）：

         * X坐标（水平）：<span data-label="purple">(W\-Crop_W)/2</span>（确保水平居中，从左侧开始）。

         * Y坐标（垂直）：总是0（因为高度全用，从顶部开始）。

4. 裁剪结果：

   * 最终裁剪出的图片尺寸为<span data-label="purple">Crop_W\*Crop_H</span>，比例严格等于<span data-label="purple">A:B</span>，且完全位于原始图片内部，无黑边。

   * 裁剪区域总是以原始图片中心为基准，因此内容居中。

5. 裁剪示例：



|输入图片 |生成的视频结果 |
|---|---|
|* 输入图片宽高：3380\*1072<br><br>* 与输入图片接近的宽高比：21:9<br><br><br><span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_b04ff44f251ef30500662b9b633cb482.png) </span><br><br> |<video src="https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_0df4f3e742648d2860e44ed45cb2bc87.mp4" controls></video><br> |
|* 输入图片宽高：936\*1664<br><br>* 与输入图片接近的宽高比：9:16<br><br><br><span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_9b34efbbfb01e4032ac692bb57e59c17.png) </span> |<video src="https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_8c9d7e04b0b0a17697c8b48e28d239f1.mp4" controls></video><br><br><br>&nbsp;<br><br>&nbsp;<br><br> |





<span id="lG0x6urQ"></span>
### 提交任务返回参数

<span id="BcLqo9tO"></span>
#### **通用返回参数**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="8XkrcJlq"></span>
#### **业务返回参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">重点关注data中以下字段，其他字段为公共返回(可忽略或不做解析)</div>



|字段 |类型 |说明 |
|---|---|---|
|task_id |string |任务ID，用于查询结果 |


<span id="RIDLPrTD"></span>
### 提交任务请求&返回完整示例

**请求示例：** 

```JSON
{
    "req_key": "jimeng_ti2v_v30_pro",
    // "binary_data_base64": [],
    "image_urls": [
        "https://xxx"
    ],
    "prompt": "千军万马",
    "seed": -1,
    "frames": 121,
    "aspect_ratio": "16:9"
}
```


**返回示例：** 

```JSON
{
    "code": 10000, //状态码，判断状态，code!=10000的情况下，不会返回task_id
    "data": {
        "task_id": "7392616336519610409" //任务ID，查询接口使用
    },
    "message": "Success",
    "request_id": "20240720103939AF0029465CF6A74E51EC", //排查错误的关键信息
    "time_elapsed": "104.852309ms" //链路耗时
}
```


<span id="2Qe4Tp56"></span>
## 查询任务

<span id="Pq06oeAc"></span>
### **查询任务请求参数**

<span id="UNhAm8Jd"></span>
#### **Query参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">拼接到url后的参数，示例：<a href="https://visual.volcengineapi.com/">https://visual.volcengineapi.com</a><a href="https://visual.volcengineapi.com?Action=CVGetResult&Version=2022-08-31">?Action=CVSync2AsyncGetResult&Version=2022\-08\-31</a></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|Action |string |必选 |接口名，固定值：**CVSync2AsyncGetResult** |
|Version |string |必选 |版本号，固定值：**2022\-08\-31** |


<span id="0B2SArFY"></span>
#### **Header参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">本服务固定值：<strong>Region为cn\-north\-1，Service为cv</strong></div>


主要用于鉴权，详见 [公共参数](https://www.volcengine.com/docs/6369/67268) \- 签名参数 \- 在Header中的场景部分

<span id="5wwgvpXD"></span>
#### **Body参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">业务请求参数，放到request.body中，MIME\-Type为<strong>application/json</strong></div>



|参数 |类型 |**可选/必选** |说明 | |
|---|---|---|---|---|
|req_key |String |必选 |服务标识<br><br>取固定值: **jimeng_ti2v_v30_pro** | |
|task_id |String |必选 |任务ID，此字段的取值为**提交任务接口**的返回 | |
|req_json |JSON String |可选 |json序列化后的字符串,目前支持隐性水印配置，可在返回结果中添加 |示例："{\"aigc_meta\": {\"content_producer\": \"xxxxxx\", \"producer_id\": \"xxxxxx\", \"content_propagator\": \"xxxxxx\", \"propagate_id\": \"xxxxxx\"}}" |


<span id="dHqY6NdR"></span>
##### **ReqJson(序列化后的结果再赋值给req_json)** 

配置信息


|**参数** |**类型** |**可选/必选** |**说明** | |
|---|---|---|---|---|
|aigc_meta |AIGCMeta |可选 |隐式标识 |隐式标识验证方式：<br><br><br>https://www.gcmark.com/web/index.html#/mark/check/video<br><br>   验证，先注册帐号 上传打标后的视频 点击开始检测 输出检测结果如下图即代表成功<br><br><br><div style="text-align: center"><br><img src="https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_37d8115b3de900fec9b697787ea51d86.png" width="2362px" /></div><br> |


<span id="MbPVqd33"></span>
##### AIGCMeta

隐式标识，依据《人工智能生成合成内容标识办法》&《网络安全技术人工智能生成合成内容标识方法》


|名称 |类型 |**可选/必选** |描述 |
|---|---|---|---|
|content_producer |string |可选 |内容生成服务ID（长度 <= 256字符） |
|producer_id |string |必选 |内容生成服务商给此图片数据的唯一ID（长度 <= 256字符） |
|content_propagator |string |必选 |内容传播服务商ID（长度 <= 256字符） |
|propagate_id |string |可选 |传播服务商给此图片数据的唯一ID（长度 <= 256字符） |


<span id="baxETG51"></span>
### 查询任务返回参数

<span id="O7rmT4WK"></span>
#### **通用返回参数**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="HJEK9xnP"></span>
#### **业务返回参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">说明</div>


<div data-tips="true" data-tips-type="default">重点关注data中以下字段，其他字段为公共返回(可忽略或不做解析)</div>



|参数名 |类型 | |
|---|---|---|
|video_url |string |生成的视频URL（有效期为 1 小时） |
|aigc_meta_tagged |bool |隐式标识是否打标成功 |
|status |string |任务执行状态<br><br><br>* in_queue：任务已提交<br><br>* generating：任务已被消费，处理中<br><br>* done：处理完成，成功或者失败，可根据外层code&message进行判断<br><br>* not_found：任务未找到，可能原因是无此任务或任务已过期(12小时)<br><br>* expired：任务已过期，请尝试重新提交任务请求 |


<span id="2RRktTMN"></span>
### 查询任务请求&返回完整示例

**请求示例：** 

```JSON
{
    "req_key": "jimeng_ti2v_v30_pro",
    "task_id": "7491596536074305586",
    "req_json": "{\"aigc_meta\": {\"content_producer\": \"001191440300192203821610000\", \"producer_id\": \"producer_id_test123\", \"content_propagator\": \"001191440300192203821610000\", \"propagate_id\": \"propagate_id_test123\"}}"
}
```


**返回示例：** 

```JSON
{
    "code": 10000, //状态码，优先判断 code=10000, 然后再判断data.status，否则解析有可能会panic
    "data": {
        "aigc_meta_tagged": true,
        "status": "done", //任务状态
        "video_url": "https://xxxx"
    },
    "message": "Success",
    "status": 10000,  //无需关注，请忽略
    "request_id": "20250805144938F6E5264E9D24EB0C4E0A", //排查错误的关键信息
    "time_elapsed": "57.354545ms" //链路耗时
}
```


**返回报错示例：** 

```JSON
{
    "code": 50413, //状态码，优先判断 code=10000, 然后再判断data.status，否则解析有可能会panic
    "data": null, //code!=10000的情况下，该字段返回为null
    "message": "Post Text Risk Not Pass", //错误信息
    "request_id": "202511281418218670D408837A9B0EB58F", //排查错误的关键信息
    "status": 50413, //无需关注，请忽略
    "time_elapsed": "36.799829ms" //链路耗时
}
```


<span id="n5f2ufqD"></span>
## 错误码

<span id="BbsmbHe2"></span>
### **通用错误码**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="dbwxYZlF"></span>
### **业务错误码**


|HttpCode |错误码 |错误消息 |描述 |是否需要重试 |
|---|---|---|---|---|
|200 |10000 |无 |请求成功 |不需要 |
|400 |50411 |Pre Img Risk Not Pass |输入图片前审核未通过 |不需要 |
|400 |50511 |Post Img Risk Not Pass |输出图片后审核未通过 |可重试 |
|400 |50412 |Text Risk Not Pass |输入文本前审核未通过 |不需要 |
|400 |50512 |Post Text Risk Not Pass |输出文本后审核未通过 |不需要 |
|400 |50413 |Post Text Risk Not Pass |输入文本含敏感词、版权词等审核不通过 |不需要 |
|400 |50516 | Post Video Risk Not Pass |输出视频后审核未通过 |可重试 |
|400 |50517 |Post Audio Risk Not Pass |输出音频后审核未通过 |可重试 |
|400 |50518 |Pre Img Risk Not Pass: Copyright |输入版权图前审核未通过 |不需要 |
|400 |50519 |Post Img Risk Not Pass: Copyright |输出版权图后审核未通过 |可重试 |
|400 |50520 |Risk Internal Error |审核服务异常 |不需要 |
|400 |50521 |Antidirt Internal Error |版权词服务异常 |不需要 |
|400 |50522 |Image Copyright Internal Error |版权图服务异常 |不需要 |
|429 |50429 |Request Has Reached API Limit, Please Try Later |QPS超限 |可重试 |
|429 |50430 |Request Has Reached API Concurrent Limit, Please Try Later |并发超限 |可重试 |
|500 |50500 |Internal Error |内部错误 |可重试 |
|500 |50501 |Internal RPC Error |内部算法错误 |可重试 |


<span id="wpZKFoEm"></span>
## 接入说明

<span id="vp5s68Px"></span>
### SDK使用说明

请参考[SDK使用说明](https://www.volcengine.com/docs/6444/1340578)

<span id="NZFToTeX"></span>
### HTTP方式接入说明

请参考[HTTP请求示例](https://www.volcengine.com/docs/6444/1390583)

&nbsp;

<span id="3c8515dd"></span>
# 前置说明（必读）

以下内容为直接使用HTTP方式调用接口的请求示例(包含签名过程)，替换关键信息即可直接调用。

**Step1(必需):**  通过火山访问控制获取AK/SK，需确保火山账号已开通对应权限和相关策略


* 正确替换示例中的`AccessKeyID`和`SecretAccessKey`参数值

* 无权限情况下会报错“”


**Step2(大多数情况下可跳过):**  查看接口文档`请求参数-Query参数`中的`Action`及对应`Version`


* 正确替换示例中的`action`和 `version`参数值


**Step3(必需):**  查看接口文档`请求参数-Body参数、请求示例`，将`请求示例`内容复制到`调用示例的body入参部分`


* 正确替换示例中的Body入参


**Step4:**  运行程序进行调试即可，待测试调通后，可以按需集成到项目中(不建议直接Copy，建议自行适配或更新包)

<span id="fc80385f"></span>
# 调用示例

<span id="d35c0a07"></span>
## **Java**

```Java
package com.volcengine.example.cv;

import com.alibaba.fastjson.JSONObject;
import com.google.common.io.ByteStreams;
import com.volcengine.helper.Utils;
import org.apache.commons.codec.binary.Hex;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Copyright (year) Beijing Volcano Engine Technology Ltd.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
public class Sign {
    private static final BitSet URLENCODER = new BitSet(256);
    private static final String CONST_ENCODE = "0123456789ABCDEF";
    public static final Charset UTF_8 = StandardCharsets.UTF_8;
    private final String region;
    private final String service;
    private final String schema;
    private final String host;
    private final String path;
    private final String ak;
    private final String sk;

    static {
        int i;
        for (i = 97; i <= 122; ++i) {
            URLENCODER.set(i);
        }
        for (i = 65; i <= 90; ++i) {
            URLENCODER.set(i);
        }
        for (i = 48; i <= 57; ++i) {
            URLENCODER.set(i);
        }
        URLENCODER.set('-');
        URLENCODER.set('_');
        URLENCODER.set('.');
        URLENCODER.set('~');
    }
    
    public static void main(String[] args) throws Exception {
        // 火山官网密钥信息, 注意sk结尾有==
        String AccessKeyID = "AK*****";
        String SecretAccessKey = "******==";
        // 请求域名
        String endpoint = "visual.volcengineapi.com";
        String path = "/"; // 路径，不包含 Query// 请求接口信息
        String service = "cv";
        String region = "cn-north-1";
        String schema = "https";
        Sign sign = new Sign(region, service, schema, endpoint, path, AccessKeyID, SecretAccessKey);
        // 参考接口文档Query参数
        String action = "CVProcess";
        String version = "2022-08-31";
        Date date = new Date();
        // 参考接口文档Body参数
        JSONObject req=new JSONObject();
        req.put("req_key","xxx");
        ArrayList<String> imageUrls = new ArrayList<String>();
        imageUrls.add("******");
        req.put("image_urls",imageUrls);
        req.put("prompt","******");

        sign.doRequest("POST", new HashMap(), req.toJSONString().getBytes(), date, action, version);
    }

    public Sign(String region, String service, String schema, String host, String path, String ak, String sk) {
        this.region = region;
        this.service = service;
        this.host = host;
        this.schema = schema;
        this.path = path;
        this.ak = ak;
        this.sk = sk;
    }

    public void doRequest(String method, Map<String, String> queryList, byte[] body,
                          Date date, String action, String version) throws Exception {
        if (body == null) {
            body = new byte[0];
        }
        String xContentSha256 = hashSHA256(body);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'");
        sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
        String xDate = sdf.format(date);
        String shortXDate = xDate.substring(0, 8);
        String contentType = "application/json";
        String signHeader = "host;x-date;x-content-sha256;content-type";

        SortedMap<String, String> realQueryList = new TreeMap<>(queryList);
        realQueryList.put("Action", action);
        realQueryList.put("Version", version);
        StringBuilder querySB = new StringBuilder();
        for (String key : realQueryList.keySet()) {
            querySB.append(signStringEncoder(key)).append("=").append(signStringEncoder(realQueryList.get(key))).append("&");
        }
        querySB.deleteCharAt(querySB.length() - 1);

        String canonicalStringBuilder = method + "\n" + path + "\n" + querySB + "\n" +
                "host:" + host + "\n" +
                "x-date:" + xDate + "\n" +
                "x-content-sha256:" + xContentSha256 + "\n" +
                "content-type:" + contentType + "\n" +
                "\n" +
                signHeader + "\n" +
                xContentSha256;

        System.out.println(canonicalStringBuilder);

        String hashcanonicalString = hashSHA256(canonicalStringBuilder.getBytes());
        String credentialScope = shortXDate + "/" + region + "/" + service + "/request";
        String signString = "HMAC-SHA256" + "\n" + xDate + "\n" + credentialScope + "\n" + hashcanonicalString;

        byte[] signKey = genSigningSecretKeyV4(sk, shortXDate, region, service);
//        String signature = HexFormat.of().formatHex(hmacSHA256(signKey, signString));
        String signature = Hex.encodeHexString(Utils.hmacSHA256(signKey, signString));

        URL url = new URL(schema + "://" + host + path + "?" + querySB);

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Host", host);
        conn.setRequestProperty("X-Date", xDate);
        conn.setRequestProperty("X-Content-Sha256", xContentSha256);
        conn.setRequestProperty("Content-Type", contentType);
        conn.setRequestProperty("Authorization", "HMAC-SHA256" +
                " Credential=" + ak + "/" + credentialScope +
                ", SignedHeaders=" + signHeader +
                ", Signature=" + signature);
        if (!Objects.equals(conn.getRequestMethod(), "GET")) {
            conn.setDoOutput(true);
            OutputStream os = conn.getOutputStream();
            os.write(body);
            os.flush();
            os.close();
        }
        conn.connect();

        int responseCode = conn.getResponseCode();

        InputStream is;
        if (responseCode == 200) {
            is = conn.getInputStream();
        } else {
            is = conn.getErrorStream();
        }
        String responseBody = new String(ByteStreams.toByteArray(is));
        is.close();

        System.out.println(responseCode);
        System.out.println(responseBody);
    }
    
    private String signStringEncoder(String source) {
        if (source == null) {
            return null;
        }
        StringBuilder buf = new StringBuilder(source.length());
        ByteBuffer bb = UTF_8.encode(source);
        while (bb.hasRemaining()) {
            int b = bb.get() & 255;
            if (URLENCODER.get(b)) {
                buf.append((char) b);
            } else if (b == 32) {
                buf.append("%20");
            } else {
                buf.append("%");
                char hex1 = CONST_ENCODE.charAt(b >> 4);
                char hex2 = CONST_ENCODE.charAt(b & 15);
                buf.append(hex1);
                buf.append(hex2);
            }
        }
        
        return buf.toString();
    }

    public static String hashSHA256(byte[] content) throws Exception {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");


            return Hex.encodeHexString(md.digest(content));
        } catch (Exception e) {
            throw new Exception(
                    "Unable to compute hash while signing request: "
                            + e.getMessage(), e);
        }
    }

    public static byte[] hmacSHA256(byte[] key, String content) throws Exception {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(content.getBytes());
        } catch (Exception e) {
            throw new Exception(
                    "Unable to calculate a request signature: "
                            + e.getMessage(), e);
        }
    }

    private byte[] genSigningSecretKeyV4(String secretKey, String date, String region, String service) throws Exception {
        byte[] kDate = hmacSHA256((secretKey).getBytes(), date);
        byte[] kRegion = hmacSHA256(kDate, region);
        byte[] kService = hmacSHA256(kRegion, service);
        return hmacSHA256(kService, "request");
    }
}
```


<span id="652553ce"></span>
## Golang

```Go
/*
Copyright (year) Beijing Volcano Engine Technology Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package main

import (
        "bytes"
        "crypto/hmac"
        "crypto/sha256"
        "encoding/hex"
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "net/http/httputil"
        "net/url"
        "strings"
        "time"
)

const (
        // 请求凭证，从访问控制申请
        AccessKeyID     = "AK*****"
        SecretAccessKey = "*****=="

        // 请求地址
        Addr = "https://visual.volcengineapi.com"
        Path = "/" // 路径，不包含 Query

        // 请求接口信息
        Service = "cv"
        Region  = "cn-north-1"

        // 请求Query信息
        Action  = "CVProcess"
        Version = "2022-08-31"
)

func hmacSHA256(key []byte, content string) []byte {
        mac := hmac.New(sha256.New, key)
        mac.Write([]byte(content))
        return mac.Sum(nil)
}

func getSignedKey(secretKey, date, region, service string) []byte {
        kDate := hmacSHA256([]byte(secretKey), date)
        kRegion := hmacSHA256(kDate, region)
        kService := hmacSHA256(kRegion, service)
        kSigning := hmacSHA256(kService, "request")

        return kSigning
}

func hashSHA256(data []byte) []byte {
        hash := sha256.New()
        if _, err := hash.Write(data); err != nil {
                log.Printf("input hash err:%s", err.Error())
        }

        return hash.Sum(nil)
}

func doRequest(method string, queries url.Values, body []byte) ([]byte, int, error) {
        // 1. 构建请求
        queries.Set("Action", Action)
        queries.Set("Version", Version)
        requestAddr := fmt.Sprintf("%s%s?%s", Addr, Path, queries.Encode())
        log.Printf("request addr: %s\n", requestAddr)

        request, err := http.NewRequest(method, requestAddr, bytes.NewBuffer(body))
        if err != nil {
                return nil, 0, fmt.Errorf("bad request: %w", err)
        }

        // 2. 构建签名材料
        now := time.Now()
        date := now.UTC().Format("20060102T150405Z")
        authDate := date[:8]
        request.Header.Set("X-Date", date)

        payload := hex.EncodeToString(hashSHA256(body))
        request.Header.Set("X-Content-Sha256", payload)
        request.Header.Set("Content-Type", "application/json")

        queryString := strings.Replace(queries.Encode(), "+", "%20", -1)
        signedHeaders := []string{"host", "x-date", "x-content-sha256", "content-type"}
        var headerList []string
        for _, header := range signedHeaders {
                if header == "host" {
                        headerList = append(headerList, header+":"+request.Host)
                } else {
                        v := request.Header.Get(header)
                        headerList = append(headerList, header+":"+strings.TrimSpace(v))
                }
        }
        headerString := strings.Join(headerList, "\n")

        canonicalString := strings.Join([]string{
                method,
                Path,
                queryString,
                headerString + "\n",
                strings.Join(signedHeaders, ";"),
                payload,
        }, "\n")
        log.Printf("canonical string:\n%s\n", canonicalString)

        hashedCanonicalString := hex.EncodeToString(hashSHA256([]byte(canonicalString)))
        log.Printf("hashed canonical string: %s\n", hashedCanonicalString)

        credentialScope := authDate + "/" + Region + "/" + Service + "/request"
        signString := strings.Join([]string{
                "HMAC-SHA256",
                date,
                credentialScope,
                hashedCanonicalString,
        }, "\n")
        log.Printf("sign string:\n%s\n", signString)

        // 3. 构建认证请求头
        signedKey := getSignedKey(SecretAccessKey, authDate, Region, Service)
        signature := hex.EncodeToString(hmacSHA256(signedKey, signString))
        log.Printf("signature: %s\n", signature)

        authorization := "HMAC-SHA256" +
                " Credential=" + AccessKeyID + "/" + credentialScope +
                ", SignedHeaders=" + strings.Join(signedHeaders, ";") +
                ", Signature=" + signature

        request.Header.Set("Authorization", authorization)
        log.Printf("authorization: %s\n", authorization)

        // 4. 打印请求，发起请求
        requestRaw, err := httputil.DumpRequest(request, true)
        if err != nil {
                return nil, 0, fmt.Errorf("dump request err: %w", err)
        }

        log.Printf("request:\n%s\n", string(requestRaw))

        response, err := http.DefaultClient.Do(request)
        if err != nil {
                return nil, 0, fmt.Errorf("do request err: %w", err)
        }
        // 5. 打印响应
        responseRaw, err := httputil.DumpResponse(response, true)
        if err != nil {
                return nil, 0, fmt.Errorf("dump response err: %w", err)
        }
        respStr := strings.ReplaceAll(string(responseRaw), "\\u0026", "&")
        log.Printf("response:\n%s\n", respStr)
        return requestRaw, response.StatusCode, err
}

func main() {
        // 请求Body信息，参考接口文档请求示例
        reqBody := map[string]interface{}{
                "req_key": "*****",
                //......
        }

        reqBodyStr, _ := json.Marshal(reqBody)
        _, _, _ = doRequest("POST", url.Values{}, reqBodyStr)
}
```


<span id="0f05efc9"></span>
## Python

```Python
import json
import sys
import os
import base64
import datetime
import hashlib
import hmac
import requests


method = 'POST'
host = 'visual.volcengineapi.com'
region = 'cn-north-1'
endpoint = 'https://visual.volcengineapi.com'
service = 'cv'

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def getSignatureKey(key, dateStamp, regionName, serviceName):
    kDate = sign(key.encode('utf-8'), dateStamp)
    kRegion = sign(kDate, regionName)
    kService = sign(kRegion, serviceName)
    kSigning = sign(kService, 'request')
    return kSigning

def formatQuery(parameters):
    request_parameters_init = ''
    for key in sorted(parameters):
        request_parameters_init += key + '=' + parameters[key] + '&'
    request_parameters = request_parameters_init[:-1]
    return request_parameters

def signV4Request(access_key, secret_key, service, req_query, req_body):
    if access_key is None or secret_key is None:
        print('No access key is available.')
        sys.exit()

    t = datetime.datetime.utcnow()
    current_date = t.strftime('%Y%m%dT%H%M%SZ')
    # current_date = '20210818T095729Z'
    datestamp = t.strftime('%Y%m%d')  # Date w/o time, used in credential scope
    canonical_uri = '/'
    canonical_querystring = req_query
    signed_headers = 'content-type;host;x-content-sha256;x-date'
    payload_hash = hashlib.sha256(req_body.encode('utf-8')).hexdigest()
    content_type = 'application/json'
    canonical_headers = 'content-type:' + content_type + '\n' + 'host:' + host + \
        '\n' + 'x-content-sha256:' + payload_hash + \
        '\n' + 'x-date:' + current_date + '\n'
    canonical_request = method + '\n' + canonical_uri + '\n' + canonical_querystring + \
        '\n' + canonical_headers + '\n' + signed_headers + '\n' + payload_hash
    # print(canonical_request)
    algorithm = 'HMAC-SHA256'
    credential_scope = datestamp + '/' + region + '/' + service + '/' + 'request'
    string_to_sign = algorithm + '\n' + current_date + '\n' + credential_scope + '\n' + hashlib.sha256(
        canonical_request.encode('utf-8')).hexdigest()
    # print(string_to_sign)
    signing_key = getSignatureKey(secret_key, datestamp, region, service)
    # print(signing_key)
    signature = hmac.new(signing_key, (string_to_sign).encode(
        'utf-8'), hashlib.sha256).hexdigest()
    # print(signature)

    authorization_header = algorithm + ' ' + 'Credential=' + access_key + '/' + \
        credential_scope + ', ' + 'SignedHeaders=' + \
        signed_headers + ', ' + 'Signature=' + signature
    # print(authorization_header)
    headers = {'X-Date': current_date,
               'Authorization': authorization_header,
               'X-Content-Sha256': payload_hash,
               'Content-Type': content_type
               }
    # print(headers)

    # ************* SEND THE REQUEST *************
    request_url = endpoint + '?' + canonical_querystring

    print('\nBEGIN REQUEST++++++++++++++++++++++++++++++++++++')
    print('Request URL = ' + request_url)
    try:
        r = requests.post(request_url, headers=headers, data=req_body)
    except Exception as err:
        print(f'error occurred: {err}')
        raise
    else:
        print('\nRESPONSE++++++++++++++++++++++++++++++++++++')
        print(f'Response code: {r.status_code}\n')
        # 使用 replace 方法将 \u0026 替换为 &
        resp_str = r.text.replace("\\u0026", "&")
        print(f'Response body: {resp_str}\n')


if __name__ == "__main__":
    # 请求凭证，从访问控制申请
    access_key = 'AK*****'
    secret_key = '*****=='

    # 请求Query，按照接口文档中填入即可
    query_params = {
        'Action': 'CVProcess',
        'Version': '2022-08-31',
    }
    formatted_query = formatQuery(query_params)

    # 请求Body，按照接口文档中填入即可
    body_params = {
        "req_key": "******",
        # ......
    }
    formatted_body = json.dumps(body_params)
    
    signV4Request(access_key, secret_key, service,
                  formatted_query, formatted_body)
```


<span id="c2bce9df"></span>
## PHP

```PHP
<?php
/**
 * Copyright (year) Beijing Volcano Engine Technology Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
require('../vendor/autoload.php');
// 需要自行安装 composer（https://getcomposer.org/doc/00-intro.md），并安装GuzzleHttp依赖， composer require guzzlehttp/guzzle:^7.0
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

// 基础信息，基本不用变更
$Host = "visual.volcengineapi.com";
$ContentType = "application/json";
$Service = "cv";
$Region = "cn-north-1";

/**
 * @throws GuzzleException
 */
// 第一步：创建一个  API 请求函数。签名计算的过程包含在该函数中。
function request($method, $query, $header, $ak, $sk, $action, $version, $body)
{
    // 第二步：创建身份证明。其中的 Service 和 Region 字段是固定的。ak 和 sk 分别代表
    // AccessKeyID 和 SecretAccessKey。同时需要初始化签名结构体。一些签名计算时需要的属性也在这里处理。
    // 初始化身份证明结构体
    global $Service, $Region, $Host, $ContentType;
    $credential = [
        'accessKeyId' => $ak,
        'secretKeyId' => $sk,
        'service' => $Service,
        'region' => $Region,
    ];
    // 初始化签名结构体
    $query = array_merge($query, [
        'Action' => $action,
        'Version' => $version
    ]);
    ksort($query);
    $requestParam = [
        // body是http请求需要的原生body
        'body' => $body,
        'host' => $Host,
        'path' => '/',
        'method' => $method,
        'contentType' => $ContentType,
        'date' => gmdate('Ymd\THis\Z'),
        'query' => $query
    ];
    // 第三步：接下来开始计算签名。在计算签名前，先准备好用于接收签算结果的 signResult 变量，并设置一些参数。
    // 初始化签名结果的结构体
    $xDate = $requestParam['date'];
    $shortXDate = substr($xDate, 0, 8);
    $xContentSha256 = hash('sha256', $requestParam['body']);
    $signResult = [
        'Host' => $requestParam['host'],
        'X-Content-Sha256' => $xContentSha256,
        'X-Date' => $xDate,
        'Content-Type' => $requestParam['contentType']
    ];
    // 第四步：计算 Signature 签名。
    $signedHeaderStr = join(';', ['content-type', 'host', 'x-content-sha256', 'x-date']);
    $canonicalRequestStr = join("\n", [
        $requestParam['method'],
        $requestParam['path'],
        http_build_query($requestParam['query']),
        join("\n", ['content-type:'. $requestParam['contentType'], 'host:'. $requestParam['host'], 'x-content-sha256:'. $xContentSha256, 'x-date:'. $xDate]),
        '',
        $signedHeaderStr,
        $xContentSha256
    ]);
    $hashedCanonicalRequest = hash("sha256", $canonicalRequestStr);
    $credentialScope = join('/', [$shortXDate, $credential['region'], $credential['service'], 'request']);
    $stringToSign = join("\n", ['HMAC-SHA256', $xDate, $credentialScope, $hashedCanonicalRequest]);
    $kDate = hash_hmac("sha256", $shortXDate, $credential['secretKeyId'], true);
    $kRegion = hash_hmac("sha256", $credential['region'], $kDate, true);
    $kService = hash_hmac("sha256", $credential['service'], $kRegion, true);
    $kSigning = hash_hmac("sha256", 'request', $kService, true);
    $signature = hash_hmac("sha256", $stringToSign, $kSigning);
    $signResult['Authorization'] = sprintf("HMAC-SHA256 Credential=%s, SignedHeaders=%s, Signature=%s", $credential['accessKeyId']. '/'. $credentialScope, $signedHeaderStr, $signature);
    $header = array_merge($header, $signResult);
    // 第五步：将 Signature 签名写入 HTTP Header 中，并发送 HTTP 请求。
    $client = new Client([
        'base_uri' => 'https://'. $requestParam['host'],
        'timeout' => 120.0,
    ]);
    $response = $client->request($method, 'https://'. $requestParam['host']. $requestParam['path'], [
        'headers' => $header,
        'query' => $requestParam['query'],
        'body' => $requestParam['body']
    ]);
    $responseContent = $response->getBody()->getContents();
    // 转换 \u0026 为 &
    $responseContent = str_replace('\u0026', '&', $responseContent);
    return $responseContent;
}
$now = time();
// 火山官网密钥信息, 注意sk结尾有==
$AccessKeyID = 'AK*****';
$SecretAccessKey = '*****==';

// 参考接口文档Query参数
$action = "CVProcess";
$version = "2022-08-31";

// 参考接口文档Body参数
$requestBody = [
    "req_key" => "******",
    //......
];
$body = json_encode($requestBody);

try {
    $response = request("POST", [], [], $AccessKeyID, $SecretAccessKey, $action, $version, $body);
    print_r($response);
} catch (GuzzleException $e) {
    print_r($e->getResponse()->getBody()->getContents() . "\n");
}
```
